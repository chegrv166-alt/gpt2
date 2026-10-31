extends Control

const Campaign=preload("res://scripts/model/campaign.gd")
const Data=preload("res://scripts/model/episode_data.gd")
const WorldView=preload("res://scripts/view/world_view.gd")
const GameHUD=preload("res://scripts/view/game_hud.gd")
var campaign=null
var battle=null
var world=null
var hud=null
var current_npc=""
var mode="move"
var busy=false
var result_encounter=""
var battle_generation=0

func _ready() -> void:
	campaign=Campaign.new()
	hud=GameHUD.new();hud.name="GameHUD";add_child(hud)
	world=WorldView.new();world.name="WorldView";hud.board_slot.add_child(world);world.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	world.location_selected.connect(open_location);world.tile_selected.connect(on_tile)
	hud.choice_selected.connect(on_choice);hud.action_selected.connect(on_action)
	hud.save_requested.connect(func():save_game());hud.load_requested.connect(func():load_game());hud.retreat_requested.connect(retreat);hud.journal_requested.connect(show_journal)
	hud.new_requested.connect(func():hud.show_document("Начать новый эпизод?","Текущие несохранённые решения будут потеряны. Ручное сохранение останется доступно.",[{"id":"restart","label":"Начать заново"},{"id":"close_panel","label":"Остаться"}]))
	await get_tree().process_frame
	refresh()
	print("CHRONICLE_READY ",JSON.stringify({"version":ProjectSettings.get_setting("application/config/version"),"platform":OS.get_name(),"party":campaign.party.size(),"locations":Data.locations().size(),"world_ready":world.is_node_ready(),"hud_ready":hud.is_node_ready()}))
	var capture=""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--capture="):capture=arg.substr(10)
		if arg=="--battle-preview":start_battle("ritual")
	if not capture.is_empty():
		await get_tree().create_timer(1.0).timeout
		if DisplayServer.get_name()!="headless":
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(capture)
			print("CAPTURE: ",capture)
		else:push_warning("Headless display cannot provide rendered screenshot")
		get_tree().quit()

func refresh() -> void:
	world.configure(campaign,battle);world.mode=mode
	hud.update_state(campaign,battle,mode,busy)

func _process(delta: float) -> void:
	if world==null or hud==null or hud.modal_visible():return
	var axis=Vector2.ZERO
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):axis.x-=1
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):axis.x+=1
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):axis.y-=1
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):axis.y+=1
	world.pan_camera(axis.normalized(),delta)

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:return
	match event.physical_keycode:
		KEY_F5:save_game();get_viewport().set_input_as_handled()
		KEY_F9:load_game();get_viewport().set_input_as_handled()
		KEY_J:show_journal();get_viewport().set_input_as_handled()
		KEY_ESCAPE:
			if hud.modal_visible() and not hud.takeover:
				on_choice("close_panel")
				get_viewport().set_input_as_handled()
		_:
			if hud.modal_visible() or battle==null:return
			var keys={KEY_1:"move",KEY_2:"attack",KEY_3:"skill",KEY_4:"transform",KEY_5:"guard",KEY_E:"interact",KEY_SPACE:"end",KEY_TAB:"voice"}
			if keys.has(event.physical_keycode):on_action(keys[event.physical_keycode]);get_viewport().set_input_as_handled()

func open_location(id: String) -> void:
	if battle!=null or busy or hud.modal_visible():return
	current_npc=id
	campaign.dialogue_id=id
	hud.show_dialogue(campaign.talk(id));refresh()

func on_choice(id: String) -> void:
	if id=="restart":
		battle_generation+=1
		world.pending_location=""
		campaign=Campaign.new();battle=null;current_npc="";mode="move";busy=false;hud.close_modal();world.route.clear();refresh();return
	if id=="close_panel":
		if battle!=null and battle.status!="playing":
			on_choice("after_battle");return
		if not campaign.pending_takeover.is_empty():
			current_npc=campaign.pending_takeover.npc
			campaign.dialogue_id=current_npc
			hud.show_dialogue(campaign.talk(current_npc));return
		hud.close_modal();current_npc="";campaign.dialogue_id="";return
	if id=="retry":hud.close_modal();start_battle(result_encounter);return
	if id=="retreat":hud.close_modal();refresh();return
	if id=="after_battle":
		battle_generation+=1
		current_npc="";campaign.dialogue_id=""
		hud.close_modal();battle=null;busy=false;refresh()
		if not campaign.ending.is_empty():show_ending()
		return
	if current_npc.is_empty():return
	var result=campaign.choose(current_npc,id)
	if not result.ok:hud.show_message(result.get("reason","Решение недоступно"));return
	match result.action:
		"battle":
			hud.close_modal();current_npc="";campaign.dialogue_id="";start_battle(result.encounter)
		"ending":hud.close_modal();current_npc="";campaign.dialogue_id="";refresh();show_ending()
		"close":hud.close_modal();current_npc="";campaign.dialogue_id="";refresh()
		_:hud.show_dialogue(campaign.talk(current_npc));refresh()

func start_battle(id: String) -> void:
	battle_generation+=1
	world.route.clear();world.pending_location=""
	battle=campaign.start_battle(id)
	if battle==null:hud.show_message("Не удалось начать столкновение");return
	mode="move";busy=false;current_npc="";campaign.dialogue_id="";hud.close_modal();refresh()
	hud.show_message("Выберите действие и клетку. Обращение тратит 1 ОД. Завершить активацию — Пробел. Отступление доступно в хронике.")

func on_action(id: String) -> void:
	if battle==null or busy or hud.modal_visible() or battle.status!="playing":return
	var actor=battle.active_unit()
	if id=="voice" and actor.id=="hero":
		var voices=Campaign.VOICES
		battle.selected_voice=voices[(voices.find(battle.selected_voice)+1)%voices.size()]
		refresh();return
	if id in ["move","attack","skill","interact"]:
		mode=id;refresh()
		var hints={"move":"Шаг: выберите свободную клетку в пределах досягаемости · 1 ОД","attack":"Удар: выберите противника в радиусе оружия · 1 ОД","skill":"Приём: Хронист — Приговор; Мирра — выстрел со связкой; Сава — лечение союзника или восстановление себя","interact":"Нажмите на золотой механизм рядом с активным героем · 1 ОД"}
		if id=="skill" and actor.id=="hero":
			var borrowed_hints={"investigator":"Выявить: цель до 5 клеток; уязвимость для следующего удара · 1 ОД", "executioner":"Приговор: тяжёлый удар рядом, игнорирует защиту · 2 ОД", "judge":"Обязать: цель до 5 клеток теряет одно действие · 1 ОД", "bandit":"Грязный удар: ближняя цель и кровотечение · 1 ОД"}
			hints[id]=str(borrowed_hints[battle.selected_voice])+" · Давление голоса +22 после боя"
		hud.show_message(hints[id]);return
	if id=="end":await end_turn();return
	var ok=false
	if id=="transform":ok=battle.transform(actor.id)
	if id=="guard":ok=battle.guard(actor.id)
	await after_action(ok)

func on_tile(tile: Vector2i) -> void:
	if battle==null or busy or hud.modal_visible() or battle.status!="playing":return
	var actor=battle.active_unit()
	var target=""
	for unit in battle.units:
		if battle.point(unit)==tile and unit.hp>0:target=unit.id
	var ok=false
	match mode:
		"move":ok=battle.move_unit(actor.id,tile)
		"attack":ok=battle.attack(actor.id,target)
		"skill":ok=battle.use_skill(actor.id,target)
		"interact":
			for objective in battle.encounter.objectives:
				var p=Vector2i(int(objective.pos[0]),int(objective.pos[1]))
				if p==tile:ok=battle.interact(actor.id,objective.id);break
	await after_action(ok)

func after_action(ok: bool) -> void:
	if not ok:hud.show_message("Действие недоступно: проверьте очки, расстояние, линию видимости и цель.");return
	world.feedback(battle.events);battle.events.clear();refresh()
	if battle.status!="playing":finish_encounter();return
	if battle.active_unit().ap<=0:await end_turn()

func end_turn() -> void:
	if busy or battle==null or battle.status!="playing":return
	var generation=battle_generation
	busy=true;refresh();hud.show_message("Противник действует…")
	await get_tree().create_timer(0.2).timeout
	if battle==null or generation!=battle_generation:return
	battle.end_activation()
	world.feedback(battle.events);battle.events.clear();refresh()
	await get_tree().create_timer(0.3).timeout
	if battle==null or generation!=battle_generation:return
	busy=false;refresh()
	if battle.status!="playing":finish_encounter()

func finish_encounter() -> void:
	result_encounter=battle.encounter.id
	var won=battle.status=="victory"
	campaign.finish_battle(battle)
	if won:
		hud.show_document("ЦЕЛЬ ДОСТИГНУТА","Обращение спадает. Раны остаются, чужие голоса ещё звучат в памяти.\n\n"+campaign.journal.back(),[{"id":"after_battle","label":"Вернуться к последствиям решения"}])
	else:
		battle=null;refresh()
		hud.show_document("ОТСТУПЛЕНИЕ","Отряд вернулся к подготовке перед столкновением. Можно повторить попытку или найти другой способ пройти.",[{"id":"retry","label":"Повторить столкновение"},{"id":"retreat","label":"Вернуться в поселение"}])

func retreat() -> void:
	if busy:return
	battle_generation+=1
	campaign.retreat();battle=null;current_npc="";campaign.dialogue_id="";hud.close_modal();refresh();hud.show_message("Отряд отступил. Подготовка перед столкновением восстановлена.")

func show_journal() -> void:
	if busy:return
	if not campaign.pending_takeover.is_empty():
		current_npc=campaign.pending_takeover.npc
		campaign.dialogue_id=current_npc
		hud.show_dialogue(campaign.talk(current_npc));return
	if battle!=null and battle.status!="playing":
		hud.show_message("Сначала завершите экран результата столкновения.");return
	current_npc=""
	var text="СВИДЕТЕЛЬСТВА: %d / 4\n\n"%campaign.evidence.size()+"\n\n".join(campaign.journal)
	var options=[{"id":"close_panel","label":"Вернуться"}]
	if battle!=null:options.append({"id":"abandon","label":"Отступить из столкновения"})
	hud.show_document("ХРОНИКА",text,options)
	if hud.choice_buttons.has("abandon"):
		hud.choice_buttons.abandon.pressed.connect(retreat)

func show_ending() -> void:
	var data=Data.all().endings.get(campaign.ending,{})
	if data.is_empty():return
	hud.show_document(data.title,data.text+"\n\nПервый эпизод завершён. Это начало истории хрониста, а не разгадка человека, которого нет.",[{"id":"close_panel","label":"Продолжить исследование"},{"id":"restart","label":"Начать другой путь"}])

func save_game(path: String="user://chronicle_save.json") -> bool:
	if busy:return false
	var temporary=path+".tmp"
	var file=FileAccess.open(temporary,FileAccess.WRITE)
	if file==null:hud.show_message("Не удалось записать сохранение");return false
	file.store_string(JSON.stringify(campaign.to_dict(),"\t"));file.close()
	var error=DirAccess.rename_absolute(ProjectSettings.globalize_path(temporary),ProjectSettings.globalize_path(path))
	if error!=OK:hud.show_message("Не удалось заменить файл сохранения");return false
	hud.show_message("Хроника сохранена");return true

func load_game(path: String="user://chronicle_save.json") -> bool:
	if busy:return false
	if not FileAccess.file_exists(path):hud.show_message("Сохранение пока не создано · F5");return false
	var parsed=JSON.parse_string(FileAccess.get_file_as_string(path))
	if not parsed is Dictionary or not campaign.restore(parsed):hud.show_message("Сохранение повреждено или несовместимо. Текущая игра сохранена.");return false
	battle_generation+=1
	battle=campaign.active_battle;mode="move";current_npc=campaign.dialogue_id;world.route.clear();world.pending_location="";hud.close_modal();refresh()
	if not current_npc.is_empty() and battle==null:hud.show_dialogue(campaign.talk(current_npc))
	hud.show_message("Хроника загружена");return true
