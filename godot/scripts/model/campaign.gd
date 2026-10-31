extends RefCounted

const Data = preload("res://scripts/model/episode_data.gd")
const Battle = preload("res://scripts/model/tactical_battle.gd")
const VOICES = ["investigator","executioner","judge","bandit"]
var party: Array = []
var flags: Dictionary = {}
var evidence: Array = []
var journal: Array = []
var pressure: Dictionary = {"investigator":12,"executioner":8,"judge":8,"bandit":8}
var coins = 6
var supplies = 3
var trust = 2
var ending = ""
var dialogue_id = ""
var world_position: Array = [7,18]
var pending_takeover: Dictionary = {}
var completed_battles: Array = []
var battle_serial = 0
var active_battle = null
var checkpoint: Dictionary = {}

func _init() -> void:
	party=Data.initial_party()
	journal=["Вель. В протоколе моей казни стояло имя человека, которого никто не видел. Нужно сверить свидетельства и добраться до уездного архива."]

func _meets(item: Dictionary) -> bool:
	for requirement in item.get("requires",[]):
		var key=str(requirement)
		if key.begins_with("!"):
			if flags.get(key.substr(1),false):return false
		elif not flags.get(key,false):return false
	if evidence.size()<int(item.get("min_evidence",0)):return false
	if coins<int(item.get("cost_coins",0)) or supplies<int(item.get("cost_supplies",0)):return false
	if not str(item.get("once","")).is_empty() and flags.get(item.once,false):return false
	return true

func _normal_talk(npc: String) -> Dictionary:
	for item in Data.dialogue(npc):
		if not _meets(item):continue
		var choices: Array=[]
		for choice in item.get("choices",[]):
			if _meets(choice):choices.append(choice.duplicate(true))
		return {"speaker":item.get("speaker",npc),"text":item.text,"choices":choices,"takeover":false}
	return {"speaker":"Тишина","text":"Здесь пока нечего добавить.","choices":[{"id":"leave","label":"Уйти","close":true}],"takeover":false}

func talk(npc: String) -> Dictionary:
	if pending_takeover.get("npc","")==npc:
		return _takeover_dialogue()
	var scripted: Dictionary=Data.all().get("takeovers",{}).get(npc,{})
	if not scripted.is_empty() and ending.is_empty() and pending_takeover.is_empty() and not flags.get("takeover_"+npc,false):
		var voice=str(scripted.voice)
		if int(pressure.get(voice,0))>=50:
			pending_takeover={"npc":npc,"voice":voice}
			flags["takeover_"+npc]=true
			trust=maxi(-6,trust-1)
			journal.append(scripted.journal)
			for key in scripted.get("flags",{}):flags[key]=scripted.flags[key]
			return _takeover_dialogue()
	return _normal_talk(npc)

func _takeover_dialogue() -> Dictionary:
	var line: Dictionary=Data.all().takeovers[pending_takeover.npc]
	return {"speaker":line.title,"text":line.text,"takeover":true,"voice":pending_takeover.voice,"choices":[{"id":"regain","label":"Вернуть себе голос"}]}

func choose(npc: String,id: String) -> Dictionary:
	if not pending_takeover.is_empty():
		if pending_takeover.npc!=npc or id!="regain":return {"ok":false,"reason":"Сначала верните себе голос"}
		pressure[pending_takeover.voice]=maxi(0,int(pressure[pending_takeover.voice])-18)
		pending_takeover.clear()
		return {"ok":true,"action":"dialogue"}
	var dialogue=_normal_talk(npc)
	var selected: Dictionary={}
	for choice in dialogue.choices:
		if choice.id==id:selected=choice;break
	if selected.is_empty():return {"ok":false,"reason":"Это решение сейчас недоступно"}
	coins-=int(selected.get("cost_coins",0));supplies-=int(selected.get("cost_supplies",0))
	supplies+=int(selected.get("supplies",0))
	trust=clampi(trust+int(selected.get("trust",0)),-6,6)
	for key in selected.get("flags",{}):flags[key]=selected.flags[key]
	if selected.has("once"):flags[selected.once]=true
	if selected.has("evidence") and not evidence.has(selected.evidence):evidence.append(selected.evidence)
	if selected.has("voice"):
		var voice=str(selected.voice)
		pressure[voice]=mini(100,int(pressure.get(voice,0))+int(selected.get("pressure",0)))
	if selected.has("journal"):journal.append(selected.journal)
	if selected.get("rest",false):
		for member in party:member.hp=member.max_hp;member.mutation=0
		calm(25)
		journal.append("У костра отряд перевязал раны. Голоса стали тише.")
	if selected.has("calm"):calm(int(selected.calm))
	if selected.has("ending"):
		ending=selected.ending;flags["episode_done"]=true
		return {"ok":true,"action":"ending"}
	if selected.has("encounter"):return {"ok":true,"action":"battle","encounter":selected.encounter}
	return {"ok":true,"action":"close" if selected.get("close",false) else "dialogue"}

func calm(amount: int) -> void:
	for voice in VOICES:pressure[voice]=maxi(0,int(pressure[voice])-amount)

func start_battle(id: String):
	if active_battle!=null:return active_battle
	var template=Data.encounter(id)
	if template.is_empty():return null
	checkpoint=_base_snapshot()
	active_battle=Battle.new(template,party)
	battle_serial+=1
	active_battle.instance_id="%s:%d" % [id,battle_serial]
	return active_battle

func finish_battle(battle) -> bool:
	if battle==null or battle!=active_battle or battle.instance_id.is_empty():return false
	if battle.status=="playing" or (not battle.instance_id.is_empty() and completed_battles.has(battle.instance_id)):return false
	if battle.status in ["defeat","retreat"]:
		if not checkpoint.is_empty():_apply_base(checkpoint)
		for member in party:member.mutation=0
		active_battle=null;checkpoint={}
		journal.append("Отряд отступил. Прежняя подготовка восстановлена; путь остаётся открытым.")
		return true
	for member in party:
		var result=battle.unit(member.id)
		if not result.is_empty():member.hp=maxi(1,int(result.hp))
		if member.id=="hero":member["voice"]=battle.selected_voice
		member.mutation=0
	for voice in battle.borrowed:pressure[voice]=mini(100,int(pressure.get(voice,0))+int(battle.borrowed[voice]))
	if not battle.instance_id.is_empty():completed_battles.append(battle.instance_id)
	coins+=2
	var id=str(battle.encounter.id)
	if id=="gate":
		flags["gate_pass"]=true;flags["access_force"]=true
		journal.append("Механизм врат захвачен. Стража отступила, путь к архиву открыт.")
	else:
		ending=id;flags["episode_done"]=true
		flags["ritual_stopped" if id=="ritual" else "prisoners_saved"]=true
		trust=mini(6,trust+1)
		journal.append("Обряд сорван, подлинник сохранён." if id=="ritual" else "Узники выведены из лечебницы. Свидетели остались живы.")
	active_battle=null;checkpoint={}
	return true

func retreat() -> bool:
	if active_battle==null:return false
	active_battle.status="retreat"
	return finish_battle(active_battle)

func _base_snapshot() -> Dictionary:
	return {"version":1,"dialogue_id":dialogue_id,"party":party.duplicate(true),"flags":flags.duplicate(true),"evidence":evidence.duplicate(),"journal":journal.duplicate(),"pressure":pressure.duplicate(true),"coins":coins,"supplies":supplies,"trust":trust,"ending":ending,"world_position":world_position.duplicate(),"pending_takeover":pending_takeover.duplicate(true),"completed_battles":completed_battles.duplicate(),"battle_serial":battle_serial}

func to_dict() -> Dictionary:
	var data=_base_snapshot()
	data["battle"]=active_battle.to_dict() if active_battle!=null else {}
	data["checkpoint"]=checkpoint.duplicate(true)
	return data

func _valid_base(data: Dictionary) -> bool:
	var required=["version","dialogue_id","party","flags","evidence","journal","pressure","coins","supplies","trust","ending","world_position","pending_takeover","completed_battles","battle_serial"]
	if not data.has_all(required) or data.version!=1:return false
	if not data.party is Array or data.party.size()!=3 or not data.flags is Dictionary or not data.pressure is Dictionary:return false
	if not data.evidence is Array or not data.journal is Array or not data.completed_battles is Array or not data.pending_takeover is Dictionary:return false
	if not data.ending in ["","rescue","ritual","bargain"] or data.coins<0 or data.supplies<0 or absi(int(data.trust))>6 or data.battle_serial<0:return false
	if not data.world_position is Array or data.world_position.size()!=2:return false
	if data.world_position[0]<0 or data.world_position[0]>29 or data.world_position[1]<0 or data.world_position[1]>23:return false
	for voice in VOICES:
		if not data.pressure.has(voice) or data.pressure[voice]<0 or data.pressure[voice]>100:return false
	var originals=Data.initial_party()
	for i in range(3):
		var member=data.party[i]
		if not member is Dictionary or not member.has_all(["id","hp","max_hp","mutation","cursed","damage","reach","art","team","pos","guard","ap","name"]):return false
		if member.id!=originals[i].id or member.max_hp!=originals[i].max_hp or member.hp<1 or member.hp>member.max_hp or member.mutation!=0 or member.cursed!=originals[i].cursed:return false
	if not data.pending_takeover.is_empty():
		if not data.pending_takeover.has_all(["npc","voice"]) or not Data.all().takeovers.has(data.pending_takeover.npc) or not VOICES.has(data.pending_takeover.voice):return false
	return true

func _apply_base(data: Dictionary) -> void:
	dialogue_id=data.dialogue_id
	party=data.party.duplicate(true);flags=data.flags.duplicate(true);evidence=data.evidence.duplicate();journal=data.journal.duplicate();pressure=data.pressure.duplicate(true)
	coins=int(data.coins);supplies=int(data.supplies);trust=int(data.trust);ending=data.ending;world_position=data.world_position.duplicate();pending_takeover=data.pending_takeover.duplicate(true);completed_battles=data.completed_battles.duplicate();battle_serial=int(data.battle_serial)

func restore(data: Dictionary) -> bool:
	if not _valid_base(data) or not data.has_all(["battle","checkpoint"]) or not data.battle is Dictionary or not data.checkpoint is Dictionary:return false
	var loaded_battle=null
	if not data.battle.is_empty():
		if not data.battle.has("encounter_id") or not _valid_base(data.checkpoint):return false
		var template=Data.encounter(str(data.battle.encounter_id))
		if template.is_empty():return false
		loaded_battle=Battle.new(template,data.party)
		if not loaded_battle.restore(data.battle):return false
	_apply_base(data)
	active_battle=loaded_battle;checkpoint=data.checkpoint.duplicate(true)
	return true
