extends SceneTree

var checks=0
var failures: Array[String]=[]
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures.append(message);print("FAIL: ",message)
func _initialize() -> void:call_deferred("run")
func run() -> void:
	root.size=Vector2i(1440,900)
	var game=load("res://main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	await process_frame
	var world=game.world
	check(world.has_method("location_rect"),"Painted location drawing and interaction share a rectangle")
	check(world.has_method("actor_rect"),"Painted actor drawing and targeting share a rectangle")
	if world.has_method("location_rect"):
		var house=load("res://scripts/model/episode_data.gd").locations()[1]
		var rect=world.location_rect(house)
		world._explore_click(rect.get_center())
		check(world.selection=="witness","Clicking the painted house body selects its actual entrance")
	world._center_on(Vector2(14,12));world._on_resize()
	check(world.ground(world.size*.5+Vector2(0,60)).distance_to(Vector2(14,12))<.01,"Layout settling preserves the chosen opening composition")
	for factor in [.5,1.2,1.7]:
		world.zoom=factor
		world.pan=Vector2(-231,98)
		var tile=Vector2(8.25,12.75)
		check(world.ground(world.screen(tile)).distance_to(tile)<.001,"Projection round trip remains exact while zoomed")
	game.start_battle("ritual")
	await process_frame
	game.battle.unit("hero").mutation=2
	if world.has_method("actor_rect"):
		var actor=game.battle.unit("hero")
		var foot=world.screen(Vector2(actor.pos[0],actor.pos[1]))
		var rect=world.actor_rect(actor,foot)
		var picked: Array=[]
		world.tile_selected.connect(func(tile):picked.append(tile))
		world.mode="skill"
		var event=InputEventMouseButton.new();event.button_index=MOUSE_BUTTON_LEFT;event.pressed=true
		var image=world.art.texture(world.art.actor_key(actor)).get_image()
		# Find an opaque point in the uppermost quarter, above the old 88px hitbox.
		var opaque=Vector2(image.get_width()*.5,image.get_height()*.2)
		for y in range(int(image.get_height()*.08),int(image.get_height()*.3)):
			var found=false
			for x in range(int(image.get_width()*.25),int(image.get_width()*.75)):
				if image.get_pixel(x,y).a>.8:opaque=Vector2(x,y);found=true;break
			if found:break
		event.position=rect.position+(opaque+Vector2(.5,.5))/Vector2(image.get_size())*rect.size
		world._gui_input(event)
		check(not picked.is_empty() and picked.back()==game.battle.point(actor),"The tall transformed silhouette can be targeted at its head")
		event.position=rect.position+Vector2(1,1)
		world._gui_input(event)
		check(picked.back()!=game.battle.point(actor),"Transparent corners around a transformed body do not steal ground clicks")
	game.retreat()
	check(game.hud.find_children("Portrait_*","TextureRect",true,false).size()==3,"All three companions have visible matching portrait controls")
	root.size=Vector2i(960,640)
	game.size=Vector2(960,640)
	await process_frame
	await process_frame
	check(game.hud.size.x<=960.5,"HUD does not force the small window wider than its viewport")
	check(game.hud.bottom.size.y<110,"Exploration has no oversized empty command strip")
	for button in game.hud.find_children("*","Button",true,false):
		if button.is_visible_in_tree():check(button.get_global_rect().end.x<=961,"Visible control fits the small viewport: "+button.text)
	game.start_battle("ritual")
	await process_frame;await process_frame
	check(game.world.size.x>=700 and game.world.size.y>=390,"Small tactical viewport retains useful playfield space")
	check(game.hud.intent_label.get_global_rect().end.y<=game.hud.sidebar.get_global_rect().end.y-8,"Enemy intentions are visible without scrolling in a small tactical window")
	for button in game.hud.action_buttons.values():
		if button.is_visible_in_tree():check(button.get_global_rect().end.x<=961 and button.get_global_rect().end.y<=641,"Tactical command remains inside small viewport: "+button.text)
	game.retreat();game.open_location("witness")
	await process_frame;await process_frame
	var dialogue_portrait=game.hud.modal_content.find_child("DialoguePortrait",true,false)
	check(dialogue_portrait!=null and dialogue_portrait.texture==game.hud.art.portrait("witness"),"Irma's actual dialogue uses her own portrait")
	check(game.hud.modal_panel.get_global_rect().end.x<=961 and game.hud.modal_panel.get_global_rect().end.y<=641,"Dialogue panel fits small viewport")
	for button in game.hud.choice_buttons.values():check(button.size.x<=game.hud.modal_panel.size.x,"Dialogue answers wrap within their panel")
	game.queue_free();await process_frame
	print("VISUAL SCENE TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
