extends SceneTree
var checks=0
var failures: Array[String]=[]
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures.append(message);print("FAIL: ",message)
func _initialize() -> void:call_deferred("run")
func run() -> void:
	root.size=Vector2i(1440,900)
	var view=load("res://scripts/view/world_view.gd").new()
	var wired=view.has_method("navigate_to")
	check(wired,"Large world supports actual distant destinations")
	view.free()
	if not wired:finish();return
	var game=load("res://main.tscn").instantiate();root.add_child(game)
	await process_frame;await process_frame
	check(game.world.navigation.region==Rect2i(0,0,512,384),"Rendered world uses full county navigation")
	var start=game.world.player
	game.show_region_map();await process_frame
	check(game.hud.modal_visible() and game.hud.region_map!=null,"M overview opens a real region panel")
	var destination=game.campaign.layout.entrance("archivist")
	game.hud.region_map.destination_selected.emit(destination);await process_frame
	check(not game.hud.modal_visible() and game.world.route.size()>100,"Map selection creates a genuine long traversable route")
	check(game.world.player.distance_to(start)<2,"Selecting distant destination does not teleport the party")
	game.world.suspended=false
	var steps=0;var safe=true
	while not game.world.route.is_empty() and steps<2000:
		if game.campaign.layout.blocked(Vector2i(game.world.route[0])):safe=false
		game.world._process(.25);steps+=1
	check(safe and game.world.route.is_empty(),"Actual world movement follows the entire safe cross-county path")
	check(game.campaign.world_position==[destination.x,destination.y],"Long journey arrives and persists at chosen destination")
	game.world.route.clear();game.world.pending_location=""
	game.campaign.discover(game.campaign.layout.entrance("forest_camp"))
	game.show_region_map();await process_frame
	check(game.hud.region_map.campaign.discovered.has("forest_camp"),"Overview uses persistent actual discoveries")
	game.hud.region_map.destination_selected.emit(Vector2i(game.campaign.layout.river_x(180),180))
	check(game.hud.modal_visible() and str(game.hud.region_map.get("notice"))!="" and game.hud.region_map.get("notice")!=null,"Unwalkable map destination explains the problem inside the map")
	root.size=Vector2i(960,640);game.size=Vector2(960,640)
	await process_frame;await process_frame
	check(game.hud.modal_panel.get_global_rect().end.x<=961 and game.hud.modal_panel.get_global_rect().end.y<=641,"Regional overview fits960×640")
	for button in game.hud.modal_content.find_children("*","Button",true,false):
		check(button.get_global_rect().end.y<=game.hud.modal_panel.get_global_rect().end.y-10,"Map controls are accessible without scrolling: "+button.text)
	game.queue_free();await process_frame;finish()
func finish() -> void:
	print("REGION SCENE TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
