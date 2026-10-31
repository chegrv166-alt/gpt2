extends SceneTree
## Render the real scene at the actual window size; not included in exports.
func _initialize() -> void:call_deferred("capture")
func capture() -> void:
	var scenario="exploration"
	var output="/tmp/painted-game.png"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--scenario="):scenario=arg.substr(11)
		if arg.begins_with("--output="):output=arg.substr(9)
	var game=load("res://main.tscn").instantiate();root.add_child(game)
	await process_frame;await process_frame
	var regions={"town":"camp","forest":"forest_camp","docks":"dock_camp","graves":"grave_camp","abbey":"abbey_camp"}
	if regions.has(scenario):
		var target=game.campaign.layout.entrance(regions[scenario])
		game.campaign.world_position=[target.x,target.y];game.campaign.discover(target);game.refresh();game.world._center_on(game.world.player)
	if scenario=="river":
		var target=Vector2i(game.campaign.layout.river_x(304),304)
		game.campaign.world_position=[target.x,target.y];game.campaign.discover(target);game.refresh();game.world._center_on(game.world.player)
	if scenario=="overview":game.show_region_map()
	if scenario in ["battle","mutation"]:game.start_battle("ritual")
	if scenario=="mutation":
		# A render fixture for both anatomical variants; no claim of input playthrough.
		game.battle.unit("hero").mutation=2;game.battle.unit("sava").mutation=2;game.refresh()
	if scenario=="dialogue":game.open_location("witness")
	if scenario=="voices":
		game.campaign.pressure.bandit=65;game.open_location("cistern")
	await create_timer(.8).timeout
	if DisplayServer.get_name()=="headless":push_error("Capture requires a graphical display");quit(1);return
	await RenderingServer.frame_post_draw
	var image=root.get_texture().get_image()
	if image.save_png(output)!=OK:quit(1);return
	print("ART CAPTURE ",JSON.stringify({"scenario":scenario,"pixels":[image.get_width(),image.get_height()],"board":[game.world.size.x,game.world.size.y],"hud":[game.hud.size.x,game.hud.size.y],"path":output}))
	game.queue_free();await process_frame;quit()
