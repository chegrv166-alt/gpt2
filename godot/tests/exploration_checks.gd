extends SceneTree
var checks=0
var failures: Array[String]=[]
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures.append(message);print("FAIL: ",message)
func _initialize() -> void:call_deferred("run")
func run() -> void:
	var Campaign=load("res://scripts/model/campaign.gd")
	var layout=load("res://scripts/model/world_layout.gd").new()
	var state=Campaign.new()
	var exists=state.get("discovered") is Array
	check(exists,"Campaign owns persistent region discoveries")
	if not exists:finish();return
	check(state.world_position==[layout.start().x,layout.start().y],"New game starts inside actual town camp")
	check(state.discovered.has("camp") and not state.discovered.has("infirmary"),"Exploration begins locally without revealing distant secrets")
	var before=state.to_dict()
	check(not state.fast_travel("forest_camp") and state.to_dict()==before,"Undiscovered fast travel rejected without side effects")
	state.discover(layout.entrance("forest_camp"))
	state.supplies=2;var hp=state.party[0].hp;var pressure=state.pressure.duplicate(true)
	check(state.fast_travel("forest_camp"),"Travel between discovered camps succeeds from a camp")
	check(state.supplies==1 and state.party[0].hp==hp and state.pressure==pressure,"Travel spends one ration and neither heals nor calms voices")
	state.world_position=[80,80];before=state.to_dict()
	check(not state.fast_travel("camp") and state.to_dict()==before,"Fast travel requires being at an actual camp")
	state.world_position=[layout.start().x,layout.start().y];state.start_battle("gate")
	check(not state.fast_travel("forest_camp"),"Fast travel blocked in active battle")
	state.retreat()
	var saved=state.to_dict();var restored=Campaign.new()
	check(restored.restore(saved) and restored.to_dict()==saved,"Version2 snapshot preserves exploration state exactly")
	var invalid=saved.duplicate(true);invalid.world_position=[512,384]
	check(not restored.restore(invalid) and restored.to_dict()==saved,"Invalid new coordinates cannot replace current campaign")
	invalid=saved.duplicate(true);invalid.discovered.append("missing_place")
	check(not restored.restore(invalid),"Unknown discoveries rejected")
	var legacy=JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/legacy_region_v1.json"))
	check(restored.restore(legacy),"Actual version1 active-battle save migrates")
	check(restored.coins==9 and restored.flags.gate_pass and restored.active_battle.unit("hero").mutation==1,"Migration preserves resources, decisions and active mutation")
	check(restored.world_position==[layout.start().x,layout.start().y] and restored.checkpoint.version==2,"Migration relocates both current position and battle checkpoint")
	restored.retreat()
	check(restored.world_position==[layout.start().x,layout.start().y] and restored.party[0].mutation==0,"Retreat after migration returns to new map, in human form")
	for id in ["road_ambush","warehouse_fight","gallows_rescue","quarry_rite"]:
		var run_state=Campaign.new();var battle=run_state.start_battle(id);battle.status="victory"
		check(run_state.finish_battle(battle) and run_state.ending.is_empty(),"Optional road victory does not finish episode: "+id)
	var cache=Campaign.new()
	check(cache.choose("broken_cart","take").ok,"One-time roadside discovery has a real outcome")
	var rewards=cache.supplies
	check(not cache.choose("broken_cart","take").ok and cache.supplies==rewards,"Reopening discovery cannot farm supplies")
	var copy=Campaign.new();copy.restore(cache.to_dict())
	check(not copy.choose("broken_cart","take").ok and copy.supplies==rewards,"Loading cannot duplicate discovery rewards")
	finish()
func finish() -> void:
	print("EXPLORATION TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
