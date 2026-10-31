extends SceneTree
const Campaign=preload("res://scripts/model/campaign.gd")
var failures: Array[String]=[]
var checks=0
func check(ok: bool,label: String) -> void:
	checks+=1
	if not ok:failures.append(label);print("FAIL: ",label)
func _initialize() -> void:call_deferred("run")

func play(battle) -> void:
	var safety=0
	while battle.status=="playing" and safety<180:
		safety+=1
		var actor=battle.active_unit()
		var used=false
		# Healing is an actual action, subject to distance and compatibility.
		if actor.id=="sava":
			var wounded=battle.allies().filter(func(a):return a.hp>0 and a.max_hp-a.hp>=12)
			wounded.sort_custom(func(a,b):return a.hp<b.hp)
			for target in wounded:
				if battle.use_skill(actor.id,target.id):used=true;break
		if used:continue
		var targets: Array=[]
		for obj in battle.encounter.objectives:
			if obj.id=="exit":continue
			if battle.progress.get(obj.id,false):continue
			if obj.id=="prisoner" and battle.progress.get("freed",false):continue
			if obj.id=="gate_winch" and battle.progress.get("last_winch_round",0)==battle.round_number:continue
			targets.append(obj)
		targets.sort_custom(func(a,b):return battle.distance(battle.point(actor),Vector2i(int(a.pos[0]),int(a.pos[1])))<battle.distance(battle.point(actor),Vector2i(int(b.pos[0]),int(b.pos[1]))))
		for obj in targets:
			if battle.interact(actor.id,obj.id):used=true;break
		if used:continue
		# Remove immediate threats before moving again.
		for foe in battle.alive_enemies():
			if battle.distance(battle.point(actor),battle.point(foe))<=battle.attack_range(actor) and battle.line_clear(battle.point(actor),battle.point(foe)):
				if actor.id=="hero" and actor.ap>=2:used=battle.use_skill(actor.id,foe.id)
				elif actor.id=="mira":used=battle.use_skill(actor.id,foe.id)
				else:used=battle.attack(actor.id,foe.id)
				if used:break
		if used:continue
		if actor.ap>0:
			var destination=Vector2i(7,7)
			if not targets.is_empty():destination=Vector2i(int(targets[0].pos[0]),int(targets[0].pos[1]))
			elif not battle.alive_enemies().is_empty():destination=battle.point(battle.alive_enemies()[0])
			var possible=battle.reachable_tiles(actor.id)
			var best=battle.point(actor)
			var score=battle.distance(best,destination)
			for tile in possible:
				var value=battle.distance(tile,destination)
				if value<score:best=tile;score=value
			if best!=battle.point(actor):used=battle.move_unit(actor.id,best)
		if not used or actor.ap<=0:battle.end_activation()
	print("PLAYTHROUGH: ",battle.encounter.id," -> ",battle.status," in ",battle.round_number," rounds / ",safety," actions")

func run() -> void:
	for id in ["road_ambush","warehouse_fight","gallows_rescue","quarry_rite"]:
		var county=Campaign.new();var road=county.start_battle(id);play(road)
		check(road.status=="victory","Road encounter can be won through legal actions: "+id)
		county.finish_battle(road)
		check(county.ending.is_empty(),"Road encounter returns to regional exploration: "+id)
	var optional=Campaign.new()
	var gate=optional.start_battle("gate")
	play(gate)
	check(gate.status=="victory","Gate confrontation can be won with legal actions")
	optional.finish_battle(gate)
	check(optional.flags.get("gate_pass",false),"Gate fight opens archive route")
	for resolution in ["rescue","ritual","bargain"]:
		var campaign=Campaign.new()
		check(campaign.choose("witness","listen").ok,"Witness evidence: "+resolution)
		check(campaign.choose("memorial","compare").ok,"Independent registry: "+resolution)
		check(campaign.choose("gate","proof").ok,"Documentary access route: "+resolution)
		check(campaign.choose("archivist","read").ok,"Archive discovery: "+resolution)
		var result=campaign.choose("infirmary",resolution)
		check(result.ok,"Final choice: "+resolution)
		if resolution!="bargain":
			var battle=campaign.start_battle(result.encounter)
			play(battle)
			check(battle.status=="victory","Encounter can be won: "+resolution)
			campaign.finish_battle(battle)
			var coins=campaign.coins
			check(not campaign.finish_battle(battle) and campaign.coins==coins,"Victory reward is idempotent")
		check(campaign.ending==resolution,"Full campaign resolution: "+resolution)
		var copy=Campaign.new()
		check(copy.restore(JSON.parse_string(JSON.stringify(campaign.to_dict()))),"Real JSON save restores ending: "+resolution)
		check(copy.ending==resolution,"Restored ending matches: "+resolution)
	print("PLAYTHROUGH TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
