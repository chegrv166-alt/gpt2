extends RefCounted

var encounter: Dictionary
var units: Array = []
var blocks: Array = []
var status = "playing"
var round_number = 1
var activation_count = 0
var active_id = "hero"
var allies_left: Array = []
var enemies_left: Array = []
var progress: Dictionary = {}
var borrowed: Dictionary = {}
var events: Array = []
var instance_id = ""
var selected_voice = "executioner"

func _init(data: Dictionary, party: Array) -> void:
	encounter = data.duplicate(true)
	blocks = []
	for tile in encounter.get("blocks", []): blocks.append([int(tile[0]),int(tile[1])])
	units = party.duplicate(true)
	var starts = [[2, 6], [2, 8], [1, 7]]
	for i in range(units.size()):
		units[i].pos = starts[i].duplicate()
		units[i].ap = 2
		units[i].mutation = 0
		units[i].guard = 0
	selected_voice = str(units[0].get("voice","executioner"))
	units.append_array(encounter.get("enemies", []).duplicate(true))
	if encounter.get("id") == "rescue":
		units.append({"id":"prisoner", "name":"Узница", "team":"neutral", "pos":[6,7], "hp":24, "max_hp":24, "damage":0, "reach":0, "mutation":0, "cursed":false, "ap":0, "guard":0, "art":"sava"})
	_new_round(false)

func unit(id: String) -> Dictionary:
	for actor in units:
		if actor.id == id:
			return actor
	return {}

func active_unit() -> Dictionary:
	return unit(active_id)

func alive_enemies() -> Array:
	return units.filter(func(u): return u.team == "enemy" and u.hp > 0)

func allies() -> Array:
	return units.filter(func(u): return u.team == "ally")

static func compatibility(level: int) -> float:
	return [1.0, 0.65, 0.3][clampi(level, 0, 2)]

static func support_amount(base: int, source: int, recipient: int) -> int:
	return maxi(1, roundi(base * compatibility(source) * compatibility(recipient)))

func point(actor: Dictionary) -> Vector2i:
	return Vector2i(int(actor.pos[0]), int(actor.pos[1]))

func in_bounds(p: Vector2i) -> bool:
	return p.x >= 0 and p.y >= 0 and p.x < int(encounter.get("width",14)) and p.y < int(encounter.get("height",12))

func is_blocked(p: Vector2i) -> bool:
	return not in_bounds(p) or blocks.has([p.x,p.y])

func occupied(p: Vector2i, except_id: String = "") -> bool:
	for actor in units:
		if actor.id != except_id and actor.hp > 0 and point(actor) == p:
			return true
	return false

func path_to(from: Vector2i, to: Vector2i, except_id: String = "") -> Array:
	if is_blocked(to) or occupied(to, except_id):
		return []
	var frontier: Array = [from]
	var visited: Dictionary = {from:from}
	var cursor = 0
	while cursor < frontier.size():
		var here: Vector2i = frontier[cursor]
		cursor += 1
		if here == to:
			var path: Array = []
			while here != from:
				path.push_front(here)
				here = visited[here]
			return path
		for step in [Vector2i.LEFT,Vector2i.RIGHT,Vector2i.UP,Vector2i.DOWN]:
			var next: Vector2i = here + step
			if not visited.has(next) and not is_blocked(next) and not occupied(next,except_id):
				visited[next] = here
				frontier.append(next)
	return []

func reachable_tiles(id: String) -> Dictionary:
	var actor=unit(id)
	if actor.is_empty():return {}
	var start=point(actor)
	var paths: Dictionary={start:[]}
	var frontier: Array=[start]
	var index=0
	while index<frontier.size():
		var here: Vector2i=frontier[index];index+=1
		var route: Array=paths[here]
		if route.size()>=movement_range(actor):continue
		for step in [Vector2i.LEFT,Vector2i.RIGHT,Vector2i.UP,Vector2i.DOWN]:
			var next: Vector2i=here+step
			if paths.has(next) or is_blocked(next) or occupied(next,id):continue
			paths[next]=route+[next];frontier.append(next)
	paths.erase(start)
	return paths

func distance(a: Vector2i,b: Vector2i) -> int:
	return absi(a.x-b.x)+absi(a.y-b.y)

func line_clear(a: Vector2i,b: Vector2i) -> bool:
	var steps = maxi(absi(b.x-a.x),absi(b.y-a.y))*4
	for i in range(1,steps):
		var p = Vector2(a).lerp(Vector2(b),float(i)/steps)
		if is_blocked(Vector2i(roundi(p.x),roundi(p.y))):
			return false
	return true

func _allowed(id: String,cost: int) -> bool:
	var actor = unit(id)
	return status == "playing" and not actor.is_empty() and actor.id == active_id and actor.team == "ally" and actor.hp > 0 and actor.ap >= cost

func movement_range(actor: Dictionary) -> int:
	return 4 + int(actor.mutation)

func move_unit(id: String,to: Vector2i) -> bool:
	if not _allowed(id,1): return false
	var actor = unit(id)
	var path = path_to(point(actor),to,id)
	if path.is_empty() or path.size() > movement_range(actor): return false
	actor.pos = [to.x,to.y]
	actor.ap -= 1
	events.append({"type":"move","id":id,"path":path,"to":to})
	return true

func attack_range(actor: Dictionary) -> int:
	return int(actor.reach) + (int(actor.mutation) if actor.cursed else 0)

func attack(id: String,target_id: String) -> bool:
	if not _allowed(id,1): return false
	var actor = unit(id)
	var target = unit(target_id)
	if target.is_empty() or target.team != "enemy" or target.hp <= 0: return false
	if distance(point(actor),point(target)) > attack_range(actor) or not line_clear(point(actor),point(target)): return false
	actor.ap -= 1
	_strike(actor,target,int(actor.damage)+int(actor.mutation)*7)
	_check_end()
	return true

func transform(id: String) -> bool:
	if not _allowed(id,1): return false
	var actor = unit(id)
	if not actor.cursed or actor.mutation >= 2: return false
	actor.mutation += 1
	actor.ap -= 1
	if id == "hero": borrowed["executioner"] = int(borrowed.get("executioner",0))+14
	events.append({"type":"transform","id":id,"amount":actor.mutation})
	return true

func revert(_id: String) -> bool:
	return false

func use_skill(id: String,target_id: String) -> bool:
	var actor = unit(id)
	var target = unit(target_id)
	if actor.is_empty() or target.is_empty() or target.hp <= 0: return false
	if id == "hero":
		var cost=2 if selected_voice=="executioner" else 1
		var reach=attack_range(actor)+1 if selected_voice in ["executioner","bandit"] else 5
		if not _allowed(id,cost) or target.team!="enemy" or distance(point(actor),point(target))>reach or not line_clear(point(actor),point(target)):return false
		if selected_voice=="judge" and int(target.get("bound",0))>0:return false
		if selected_voice=="investigator" and int(target.get("exposed",0))>0:return false
		actor.ap-=cost
		borrowed[selected_voice]=int(borrowed.get(selected_voice,0))+22
		match selected_voice:
			"executioner":_strike(actor,target,21+int(actor.mutation)*9+int(target.get("guard",0)))
			"investigator":target["exposed"]=support_amount(8,actor.mutation,0)
			"judge":target["bound"]=1
			"bandit":
				_strike(actor,target,9+int(actor.mutation)*4)
				target["bleeding"]=4
		events.append({"type":"voice","id":id,"voice":selected_voice})
	elif id == "mira":
		if not _allowed(id,1) or target.team != "enemy" or distance(point(actor),point(target)) > 5 or not line_clear(point(actor),point(target)): return false
		actor.ap -= 1
		_strike(actor,target,8)
		for ally in allies():
			if ally.id != id and ally.hp > 0 and distance(point(ally),point(target)) <= attack_range(ally) and line_clear(point(ally),point(target)):
				_strike(ally,target,support_amount(10,actor.mutation,ally.mutation))
				break
	else:
		if not _allowed(id,1) or target.team != "ally" or distance(point(actor),point(target)) > 4 or not line_clear(point(actor),point(target)): return false
		actor.ap -= 1
		var amount = 12+int(actor.mutation)*6 if id == target_id else support_amount(20,actor.mutation,target.mutation)
		target.hp = mini(target.max_hp,target.hp+amount)
		events.append({"type":"heal","id":target_id,"amount":amount})
	_check_end()
	return true

func guard(id: String) -> bool:
	if not _allowed(id,1): return false
	var actor = unit(id)
	actor.ap -= 1
	actor.guard = 5
	events.append({"type":"guard","id":id})
	return true

func interact(id: String,objective_id: String) -> bool:
	if not _allowed(id,1): return false
	var objective: Dictionary = {}
	for item in encounter.get("objectives",[]):
		if item.id == objective_id: objective = item
	if objective.is_empty(): return false
	var location = Vector2i(int(objective.pos[0]),int(objective.pos[1]))
	if distance(point(unit(id)),location)>1 or not line_clear(point(unit(id)),location): return false
	if objective_id.begins_with("seal_"):
		if progress.get(objective_id,false): return false
		progress[objective_id] = true
	elif objective_id == "gate_winch":
		if progress.get("last_winch_round",0) == round_number: return false
		progress["last_winch_round"] = round_number
		progress["winch"] = int(progress.get("winch",0))+1
	elif objective_id == "prisoner":
		if progress.get("freed",false): return false
		progress["freed"] = true
	else: return false
	unit(id).ap -= 1
	events.append({"type":"objective","id":objective_id})
	_check_end()
	return true

func _strike(source: Dictionary,target: Dictionary,amount: int) -> void:
	if target.hp <= 0: return
	var applied = maxi(1,amount-int(target.get("guard",0))+int(target.get("exposed",0)))
	target["exposed"]=0
	target.hp = maxi(0,int(target.hp)-applied)
	events.append({"type":"damage","source":source.id,"id":target.id,"amount":applied})

func end_activation() -> bool:
	if status != "playing" or active_unit().is_empty(): return false
	unit(active_id).ap = 0
	allies_left.erase(active_id)
	activation_count += 1
	_advance_prisoner()
	_check_end()
	if status != "playing": return true
	_enemy_activation()
	if status != "playing": return true
	allies_left = allies_left.filter(func(id): return unit(id).hp > 0)
	while allies_left.is_empty() and not enemies_left.is_empty() and status == "playing":
		_enemy_activation()
	if status != "playing": return true
	if allies_left.is_empty(): _new_round(true)
	else: _activate(allies_left[0])
	return true

func _new_round(increment: bool) -> void:
	if increment: round_number += 1
	if round_number > int(encounter.get("round_limit",8)):
		status = "defeat"
		return
	allies_left.clear()
	enemies_left.clear()
	for actor in units:
		actor.guard = 0
		if actor.hp <= 0: continue
		if actor.team == "ally": allies_left.append(actor.id)
		if actor.team == "enemy": enemies_left.append(actor.id)
	if not allies_left.is_empty(): _activate(allies_left[0])
	else: status = "defeat"

func _activate(id: String) -> void:
	active_id = id
	unit(id).ap = 2
	if unit(id).mutation == 2:
		unit(id).hp = mini(unit(id).max_hp,unit(id).hp+3)

func intent(actor: Dictionary) -> Dictionary:
	var targets = allies().filter(func(u): return u.hp>0)
	if encounter.id == "rescue" and progress.get("freed",false) and unit("prisoner").hp>0:
		targets.append(unit("prisoner"))
	if targets.is_empty(): return {}
	targets.sort_custom(func(a,b): return distance(point(actor),point(a)) < distance(point(actor),point(b)))
	return {"target":targets[0].id,"text":"%s → %s" % [actor.name,targets[0].name]}

func _enemy_activation() -> void:
	if enemies_left.is_empty(): return
	var id = enemies_left.pop_front()
	var actor = unit(id)
	if actor.hp <= 0: return
	activation_count += 1
	if int(actor.get("bleeding",0))>0:
		_strike(actor,actor,int(actor.bleeding));actor.bleeding=0;_check_end()
		if actor.hp<=0 or status!="playing":return
	var lost_action=int(actor.get("bound",0));actor["bound"]=0
	for action in range(lost_action,2):
		var plan = intent(actor)
		if plan.is_empty(): break
		var target = unit(plan.target)
		if distance(point(actor),point(target)) <= int(actor.reach) and line_clear(point(actor),point(target)):
			_strike(actor,target,int(actor.damage))
		else:
			var best: Array = []
			var best_score = 100000
			var options=reachable_tiles(id)
			for dest in options:
				var route: Array=options[dest]
				var score=distance(dest,point(target))*10+route.size()
				if score<best_score:
					best_score=score;best=route
			if not best.is_empty():
				var dest: Vector2i = best.back()
				actor.pos=[dest.x,dest.y]
				events.append({"type":"move","id":id,"to":dest})
			else: break
		_check_end()
		if status != "playing": break

func _advance_prisoner() -> void:
	if encounter.id != "rescue" or not progress.get("freed",false): return
	var captive = unit("prisoner")
	if captive.hp <= 0: return
	var path = path_to(point(captive),Vector2i(1,6),"prisoner")
	if not path.is_empty():
		var dest: Vector2i = path[mini(1,path.size()-1)]
		captive.pos=[dest.x,dest.y]
		events.append({"type":"move","id":"prisoner","to":dest})

func _check_end() -> void:
	if status != "playing": return
	if allies().all(func(u):return u.hp<=0): status="defeat";return
	if encounter.id == "rescue":
		if unit("prisoner").hp<=0: status="defeat"
		elif progress.get("freed",false) and distance(point(unit("prisoner")),Vector2i(1,6))<=1: status="victory"
	elif encounter.id == "ritual":
		if progress.get("seal_a",false) and progress.get("seal_b",false): status="victory"
	elif alive_enemies().is_empty() or int(progress.get("winch",0))>=2: status="victory"

func queue_names() -> Array:
	var result: Array = []
	var a=allies_left.duplicate();var e=enemies_left.duplicate()
	while not a.is_empty() or not e.is_empty():
		if not a.is_empty():
			var actor=unit(a.pop_front())
			if actor.hp>0:result.append(actor.name)
		if not e.is_empty():
			var actor=unit(e.pop_front())
			if actor.hp>0:result.append(actor.name)
	return result

func to_dict() -> Dictionary:
	return {"selected_voice":selected_voice,"encounter_id":encounter.id,"instance_id":instance_id,"units":units.duplicate(true),"status":status,"round":round_number,"activations":activation_count,"active":active_id,"allies_left":allies_left.duplicate(),"enemies_left":enemies_left.duplicate(),"progress":progress.duplicate(true),"borrowed":borrowed.duplicate(true)}

func restore(data: Dictionary) -> bool:
	var required=["selected_voice","encounter_id","instance_id","units","status","round","activations","active","allies_left","enemies_left","progress","borrowed"]
	for key in required:
		if not data.has(key): return false
	if not data.selected_voice in ["investigator","executioner","judge","bandit"]:return false
	if data.encounter_id != encounter.id or not data.status in ["playing","victory","defeat","retreat"]:return false
	if not data.units is Array or data.units.size()!=units.size() or not data.progress is Dictionary or not data.borrowed is Dictionary:return false
	if not data.allies_left is Array or not data.enemies_left is Array or data.round<1 or data.round>20 or data.activations<0:return false
	var ids: Array=[]
	for actor in data.units:
		if not actor is Dictionary or not actor.has_all(["id","team","pos","hp","max_hp","ap","mutation","damage","reach","cursed","guard","name","art"]):return false
		var original=unit(str(actor.id))
		if original.is_empty() or ids.has(actor.id) or actor.team!=original.team or not actor.pos is Array or actor.pos.size()!=2:return false
		var p=Vector2i(int(actor.pos[0]),int(actor.pos[1]))
		if is_blocked(p) or actor.hp<0 or actor.hp>original.max_hp or actor.max_hp!=original.max_hp or actor.ap<0 or actor.ap>2 or actor.mutation<0 or actor.mutation>2:return false
		ids.append(actor.id)
	if not ids.has(data.active):return false
	for id in data.allies_left+data.enemies_left:
		if not ids.has(id):return false
	selected_voice=data.selected_voice
	units=data.units.duplicate(true);status=data.status;round_number=int(data.round);activation_count=int(data.activations);active_id=data.active
	allies_left=data.allies_left.duplicate();enemies_left=data.enemies_left.duplicate();progress=data.progress.duplicate(true);borrowed=data.borrowed.duplicate(true);instance_id=data.instance_id
	events.clear()
	return true
