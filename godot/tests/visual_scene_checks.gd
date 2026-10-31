extends SceneTree

var checks=0
var failures: Array[String]=[]
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures.append(message);print("FAIL: ",message)
func _initialize() -> void:call_deferred("run")
func run() -> void:
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
		event.position=rect.position+opaque/Vector2(image.get_size())*rect.size
		world._gui_input(event)
		check(not picked.is_empty() and picked.back()==game.battle.point(actor),"The tall transformed silhouette can be targeted at its head")
	game.retreat()
	game.queue_free();await process_frame
	print("VISUAL SCENE TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
