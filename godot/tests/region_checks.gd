extends SceneTree
var checks=0
var failures: Array[String]=[]
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures.append(message);print("FAIL: ",message)
func _initialize() -> void:call_deferred("run")
func run() -> void:
	var exists=ResourceLoader.exists("res://scripts/model/world_layout.gd")
	check(exists,"Continuous region geography exists")
	if not exists:finish();return
	var layout=load("res://scripts/model/world_layout.gd").new()
	var data=load("res://scripts/model/episode_data.gd")
	check(layout.bounds()==Rect2i(0,0,512,384),"Actual navigable region is512×384")
	check(data.locations().size()==46,"Thirty named places and sixteen real discoveries")
	check(layout.data.districts.size()==5,"Five distinct districts")
	check(layout.camps().size()==5,"Five travel/rest anchor camps")
	var nav=layout.navigation()
	for place in data.locations():
		var entry=layout.entrance(place.id)
		check(not layout.blocked(entry),"Place entrance is physically walkable: "+place.id)
		check(not nav.get_id_path(layout.start(),entry).is_empty(),"Place reachable from starting camp: "+place.id)
	for bridge in layout.data.bridges:
		var center=Vector2i(layout.river_x(bridge.y),bridge.y)
		check(not layout.blocked(center),"Visible bridge crosses the physical river")
	check(layout.blocked(Vector2i(layout.river_x(180),180)),"River water is not walkable")
	check(layout.blocked(Vector2i(-1,20)) and layout.blocked(Vector2i(512,20)),"Region edges reject out-of-bounds movement")
	finish()
func finish() -> void:
	print("REGION TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
