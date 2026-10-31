extends SceneTree
var failures: Array[String]=[]
var checks=0
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures.append(message);print("FAIL: ",message)
func _initialize() -> void:call_deferred("run")
func run() -> void:
	check(FileAccess.file_exists("res://main.tscn"),"Playable main scene exists")
	if not failures.is_empty():quit(1);return
	var packed=load("res://main.tscn")
	var game=packed.instantiate()
	root.add_child(game)
	await process_frame
	await process_frame
	check(game.campaign.party.size()==3,"Scene owns campaign")
	check(game.world!=null and game.hud!=null,"World and HUD mounted")
	game.world.location_selected.emit("witness")
	await process_frame
	check(game.hud.modal_visible(),"Location opens real dialogue panel")
	var button=game.hud.choice_buttons.get("listen")
	check(button!=null,"Actual dialogue choice button exists")
	if button:button.pressed.emit()
	await process_frame
	check(game.campaign.evidence.has("witness"),"Dialogue button changes campaign")
	game.hud.close_modal()
	game.start_battle("gate")
	await process_frame
	check(game.battle!=null,"Tactical scene active")
	var clicked: Array=[]
	game.world.tile_selected.connect(func(tile):clicked.append(tile))
	game.world.mode="attack"
	var enemy=game.battle.unit("archer")
	var event=InputEventMouseButton.new()
	event.button_index=MOUSE_BUTTON_LEFT;event.pressed=true
	event.position=game.world.screen(Vector2(float(enemy.pos[0]),float(enemy.pos[1])))-Vector2(0,40)*game.world.zoom
	game.world._gui_input(event)
	check(not clicked.is_empty() and clicked.back()==game.battle.point(enemy),"Clicking an enemy silhouette selects its ground tile")
	var old_ap=game.battle.unit("hero").ap
	game.hud.action_buttons["transform"].pressed.emit()
	await create_timer(0.5).timeout
	check(game.battle.unit("hero").mutation==1,"HUD transform button acts on real model")
	check(game.battle.unit("hero").ap==old_ap-1,"UI action spends actual AP")
	check(game.save_game("user://scene_test_save.json"),"Save from scene succeeds")
	game.campaign.coins=0
	check(game.load_game("user://scene_test_save.json"),"Load from scene succeeds")
	check(game.campaign.coins==6 and game.battle.unit("hero").mutation==1,"Load restores active battle and campaign")
	game.hud.journal_button.pressed.emit()
	await process_frame
	check(game.hud.modal_visible(),"Journal opens in battle")
	var pos=game.battle.unit("hero").pos.duplicate()
	game.world.tile_selected.emit(Vector2i(3,6))
	check(game.battle.unit("hero").pos==pos,"Modal blocks board actions")
	game.hud.close_modal()
	game.retreat()
	check(game.battle==null and game.campaign.party[0].mutation==0,"Retreat restores exploration and human form")
	# A journal shortcut cannot dismiss an involuntary exchange.
	game.campaign.pressure["investigator"]=60
	game.open_location("archivist")
	check(game.hud.takeover,"Automatic takeover shown in scene")
	game.hud.journal_button.pressed.emit()
	check(game.hud.takeover and game.current_npc=="archivist","Journal preserves takeover and recovery choice")
	if game.hud.choice_buttons.has("regain"):game.hud.choice_buttons.regain.pressed.emit()
	game.hud.close_modal()
	# Escape must finish a terminal encounter rather than strand the board.
	game.start_battle("gate")
	game.battle.status="victory"
	game.finish_encounter()
	var escape=InputEventKey.new();escape.physical_keycode=KEY_ESCAPE;escape.pressed=true
	game._unhandled_key_input(escape)
	check(game.battle==null,"Escape from victory returns to exploration")
	game.hud.close_modal()
	# Old enemy-turn timers must not advance a newly created encounter.
	game.start_battle("gate")
	game.on_action("transform");game.on_action("transform")
	game.on_choice("restart")
	game.start_battle("gate")
	await create_timer(0.7).timeout
	check(game.battle.activation_count==0 and game.battle.active_id=="hero","Restart invalidates old turn timers")
	game.retreat()
	game.size=Vector2(960,640)
	await process_frame
	check(game.hud.sidebar.custom_minimum_size.x<=280,"Compact layout keeps playfield usable")
	if DisplayServer.get_name()!="headless":
		await RenderingServer.frame_post_draw
		get_root().get_texture().get_image().save_png("/tmp/godot-scene-smoke.png")
	game.queue_free()
	await process_frame
	print("SCENE TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
