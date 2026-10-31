extends VBoxContainer
const Art=preload("res://scripts/view/art_library.gd")
const Sigil=preload("res://scripts/view/sigil.gd")
var art=Art.new()
var party_portraits: Dictionary={}
var party_cards: Dictionary={}
var voice_meters: Dictionary={}
var party_columns: Dictionary={}
var party_roles: Dictionary={}

signal choice_selected(id: String)
signal action_selected(id: String)
signal save_requested
signal load_requested
signal retreat_requested
signal region_requested
signal region_destination(point: Vector2i)
signal region_travel(id: String)
var region_map=null
var region_mode=false
signal journal_requested
signal new_requested
var board_slot: Control
var sidebar: PanelContainer
var sidebar_box: VBoxContainer
var bottom: PanelContainer
var action_row: HFlowContainer
var status_label: Label
var objective_label: Label
var party_labels: Dictionary={}
var party_bars: Dictionary={}
var voice_bars: Dictionary={}
var voice_labels: Dictionary={}
var voice_box: VBoxContainer
var queue_label: Label
var intent_label: Label
var action_buttons: Dictionary={}
var choice_buttons: Dictionary={}
var journal_button: Button
var modal_layer: Control
var modal_panel: PanelContainer
var modal_content: VBoxContainer
var takeover=false
var is_battle=false
var compact=false
var body_font: Font
var title_font: Font

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);add_theme_constant_override("separation",0)
	body_font=load("res://assets/body.ttf");title_font=load("res://assets/title.ttf")
	var custom=Theme.new();custom.default_font=body_font;custom.default_font_size=14
	custom.set_stylebox("normal","Button",_style(Color("20242c"),Color("595044"),9))
	custom.set_stylebox("hover","Button",_style(Color("32333a"),Color("b09a70"),9))
	custom.set_stylebox("pressed","Button",_style(Color("42362d"),Color("d4b77d"),9))
	custom.set_stylebox("focus","Button",_style(Color(0,0,0,0),Color("d7bc87"),9))
	custom.set_stylebox("disabled","Button",_style(Color("161a20"),Color("33343a"),9))
	custom.set_font_size("font_size","Button",12)
	custom.set_color("font_color","Button",Color("d8d0c2"));custom.set_color("font_disabled_color","Button",Color("69717a"))
	custom.set_color("font_color","Label",Color("d3cdbf"));theme=custom
	_build_header()
	var center=HBoxContainer.new();center.size_flags_vertical=Control.SIZE_EXPAND_FILL;center.add_theme_constant_override("separation",0);add_child(center)
	board_slot=Control.new();board_slot.name="BoardSlot";board_slot.size_flags_horizontal=Control.SIZE_EXPAND_FILL;board_slot.size_flags_vertical=Control.SIZE_EXPAND_FILL;center.add_child(board_slot)
	sidebar=PanelContainer.new();sidebar.name="Sidebar";sidebar.custom_minimum_size=Vector2(284,0)
	var edge=_style(Color("151a21"),Color("534c40"),15);edge.set_border_width_all(0);edge.border_width_left=1
	sidebar.add_theme_stylebox_override("panel",edge);center.add_child(sidebar)
	var scroll=ScrollContainer.new();scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;sidebar.add_child(scroll)
	sidebar_box=VBoxContainer.new();sidebar_box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;sidebar_box.add_theme_constant_override("separation",12);scroll.add_child(sidebar_box)
	_section(sidebar_box,"С П У Т Н И К И")
	for item in [["hero","ХРОНИСТ","Носитель · проклятие"],["mira","МИРРА","Лучница · человек"],["sava","САВА","Лекарь · проклятие"]]:
		var card=PanelContainer.new();card.add_theme_stylebox_override("panel",_style(Color("1c2129"),Color("42433f"),8));sidebar_box.add_child(card);party_cards[item[0]]=card
		var row=HBoxContainer.new();row.add_theme_constant_override("separation",10);card.add_child(row)
		var frame=PanelContainer.new();frame.add_theme_stylebox_override("panel",_style(Color("10141a"),Color("695b46"),1));row.add_child(frame)
		var portrait=TextureRect.new();portrait.name="Portrait_"+item[0];portrait.texture=art.portrait(item[0])
		portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;portrait.custom_minimum_size=Vector2(68,88)
		frame.add_child(portrait);party_portraits[item[0]]=portrait
		var column=VBoxContainer.new();column.size_flags_horizontal=Control.SIZE_EXPAND_FILL;column.add_theme_constant_override("separation",5);row.add_child(column);party_columns[item[0]]=column
		var name_label=_label(item[1],16,Color("d9cdb7"));name_label.add_theme_font_override("font",title_font);column.add_child(name_label)
		var role=_wrap(item[2],10,Color("969fa6"));column.add_child(role);party_roles[item[0]]=role;portrait.tooltip_text=item[1]+" · "+item[2]
		var bar=ProgressBar.new();bar.show_percentage=false;bar.custom_minimum_size.y=4
		bar.add_theme_stylebox_override("background",_style(Color("10141b"),Color("10141b"),0))
		bar.add_theme_stylebox_override("fill",_style(Color("9aabb4"),Color("9aabb4"),0));column.add_child(bar);party_bars[item[0]]=bar
		var detail=_wrap("",11,Color("b9b5aa"));column.add_child(detail);party_labels[item[0]]=detail
	voice_box=VBoxContainer.new();voice_box.add_theme_constant_override("separation",7);sidebar_box.add_child(voice_box)
	_section(voice_box,"ЧЕТЫРЕ МЁРТВЫХ ГОЛОСА")
	for voice in [["investigator","Дознаватель"],["executioner","Палач"],["judge","Судья"],["bandit","Бандит"]]:
		var line=VBoxContainer.new();line.add_theme_constant_override("separation",3);voice_box.add_child(line)
		var row=HBoxContainer.new();line.add_child(row)
		var label=_label(voice[1],11,Color("ada8a1"));label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;row.add_child(label);voice_labels[voice[0]]=label
		var value=_label("",10,Color("b78381"));row.add_child(value);voice_bars[voice[0]]=value
		var bar=ProgressBar.new();bar.show_percentage=false;bar.max_value=100;bar.custom_minimum_size.y=2
		bar.add_theme_stylebox_override("background",_style(Color("252a31"),Color("252a31"),0));bar.add_theme_stylebox_override("fill",_style(Color("925e64"),Color("925e64"),0))
		line.add_child(bar);voice_meters[voice[0]]=bar
	voice_box.add_child(_wrap("Давление 50: чужая воля может перехватить разговор.",10,Color("808b96")))
	var rule=HSeparator.new();sidebar_box.add_child(rule)
	queue_label=_wrap("",12,Color("c3b99f"));sidebar_box.add_child(queue_label)
	intent_label=_wrap("",12,Color("9da7af"));sidebar_box.add_child(intent_label)
	bottom=PanelContainer.new();bottom.name="CommandStrip";bottom.add_theme_stylebox_override("panel",_style(Color("11161d"),Color("51493d"),12));add_child(bottom)
	var bottom_box=VBoxContainer.new();bottom_box.add_theme_constant_override("separation",7);bottom.add_child(bottom_box)
	objective_label=_wrap("",13,Color("d1bf98"));objective_label.add_theme_font_override("font",title_font);bottom_box.add_child(objective_label)
	action_row=HFlowContainer.new();action_row.add_theme_constant_override("h_separation",6);action_row.add_theme_constant_override("v_separation",5);bottom_box.add_child(action_row)
	for item in [["voice","Голос · Tab"],["move","1 · Шаг"],["attack","2 · Удар"],["skill","3 · Приём"],["transform","4 · Обращение"],["guard","5 · Прикрыться"],["interact","E · Механизм"],["end","Завершить · Пробел"]]:
		var id: String=item[0];var button=_button(item[1]);button.custom_minimum_size.y=34
		button.pressed.connect(func():action_selected.emit(id));action_row.add_child(button);action_buttons[id]=button
	status_label=_wrap("",11,Color("919ba4"));bottom_box.add_child(status_label)
	_build_modal();resized.connect(_responsive);_responsive()

func _responsive() -> void:
	if sidebar==null:return
	compact=size.x<1150;sidebar.custom_minimum_size.x=230 if compact else 284
	sidebar_box.add_theme_constant_override("separation",6 if compact else 12)
	for key in party_portraits:
		party_portraits[key].custom_minimum_size=Vector2(42,54) if compact else Vector2(68,88)
		party_roles[key].visible=not compact
		party_columns[key].add_theme_constant_override("separation",3 if compact else 5)
		party_columns[key].get_child(0).add_theme_font_size_override("font_size",14 if compact else 16)
		party_labels[key].add_theme_font_size_override("font_size",10 if compact else 11)
		party_cards[key].add_theme_stylebox_override("panel",_style(Color("1c2129"),Color("42433f"),5 if compact else 8))
	queue_label.add_theme_font_size_override("font_size",11 if compact else 12)
	intent_label.add_theme_font_size_override("font_size",11 if compact else 12)
	if modal_panel!=null:
		if region_mode and region_map!=null:region_map.custom_minimum_size.y=minf(450,get_viewport_rect().size.y-320)
		modal_panel.custom_minimum_size.x=minf(1020 if region_mode else 760,get_viewport_rect().size.x-48)
		(modal_content.get_parent() as ScrollContainer).custom_minimum_size.y=minf(660,get_viewport_rect().size.y-104) if region_mode else minf(490,get_viewport_rect().size.y-145)

func _build_header() -> void:
	var panel=PanelContainer.new();panel.name="Header";panel.custom_minimum_size.y=58
	var style=_style(Color("10151c"),Color("695b42"),10);style.set_border_width_all(0);style.border_width_bottom=1
	panel.add_theme_stylebox_override("panel",style);add_child(panel)
	var row=HBoxContainer.new();row.add_theme_constant_override("separation",10);panel.add_child(row)
	var emblem=Sigil.new();emblem.custom_minimum_size=Vector2(33,34);row.add_child(emblem)
	var title=VBoxContainer.new();title.add_theme_constant_override("separation",1);title.size_flags_horizontal=Control.SIZE_EXPAND_FILL;row.add_child(title)
	var logo=_label("ASHEN COVENANT",18,Color("d6c09a"));logo.add_theme_font_override("font",title_font);title.add_child(logo)
	title.add_child(_label("ИМЯ, КОТОРОГО НЕТ",9,Color("7e8994")))
	var map_button=_button("Карта · M");map_button.pressed.connect(func():region_requested.emit());row.add_child(map_button)
	journal_button=_button("Хроника · J");journal_button.pressed.connect(func():journal_requested.emit());row.add_child(journal_button)
	var save=_button("Записать · F5");save.pressed.connect(func():save_requested.emit());row.add_child(save)
	var restore=_button("Загрузить · F9");restore.pressed.connect(func():load_requested.emit());row.add_child(restore)
	var restart=_button("Новый эпизод");restart.pressed.connect(func():new_requested.emit());row.add_child(restart)

func _build_modal() -> void:
	modal_layer=Control.new();modal_layer.name="Modal";modal_layer.theme=theme;modal_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);modal_layer.mouse_filter=Control.MOUSE_FILTER_STOP;modal_layer.z_index=50
	get_parent().add_child.call_deferred(modal_layer)
	var shade=ColorRect.new();shade.color=Color(.014,.02,.03,.76);shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);shade.mouse_filter=Control.MOUSE_FILTER_STOP;modal_layer.add_child(shade)
	var margin=MarginContainer.new();margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);margin.add_theme_constant_override("margin_left",30);margin.add_theme_constant_override("margin_right",30);margin.add_theme_constant_override("margin_top",25);margin.add_theme_constant_override("margin_bottom",25);modal_layer.add_child(margin)
	var center=CenterContainer.new();center.size_flags_horizontal=Control.SIZE_EXPAND_FILL;center.size_flags_vertical=Control.SIZE_EXPAND_FILL;margin.add_child(center)
	modal_panel=PanelContainer.new();modal_panel.custom_minimum_size=Vector2(760,0)
	var frame=_style(Color("191e26"),Color("9a805a"),26);frame.shadow_color=Color(0,0,0,.65);frame.shadow_size=18
	modal_panel.add_theme_stylebox_override("panel",frame);center.add_child(modal_panel)
	var scroll=ScrollContainer.new();scroll.custom_minimum_size=Vector2(0,250);scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;modal_panel.add_child(scroll)
	modal_content=VBoxContainer.new();modal_content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;modal_content.add_theme_constant_override("separation",14);scroll.add_child(modal_content)
	modal_layer.hide()

func _style(bg: Color,border: Color,padding: int) -> StyleBoxFlat:
	var box=StyleBoxFlat.new();box.bg_color=bg;box.border_color=border;box.set_border_width_all(1);box.set_content_margin_all(padding);box.set_corner_radius_all(0);return box

func _label(text: String,font_size: int,color: Color) -> Label:
	var label=Label.new();label.text=text;label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",color);return label

func _wrap(text: String,font_size: int,color: Color) -> Label:
	var label=_label(text,font_size,color);label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;return label

func _button(text: String) -> Button:
	var button=Button.new();button.text=text;button.mouse_default_cursor_shape=Control.CURSOR_POINTING_HAND;return button

func _section(parent: Node,text: String) -> void:
	var label=_label(text,12,Color("a8987b"));parent.add_child(label)

func update_state(campaign,battle,mode: String,busy: bool=false) -> void:
	is_battle=battle!=null
	_responsive()
	for member in campaign.party:
		var actor=battle.unit(member.id) if battle!=null else member
		party_bars[member.id].max_value=actor.max_hp;party_bars[member.id].value=actor.hp
		party_labels[member.id].text="%d / %d · %s"%[actor.hp,actor.max_hp,(("Облик %d" if compact else "Обращение %d")%actor.mutation if actor.mutation>0 else "Человек")]
		party_portraits[member.id].modulate=Color("c79292") if actor.mutation>0 else Color.WHITE
		party_cards[member.id].modulate=Color(1.1,1.06,.98) if is_battle and member.id==battle.active_id else Color.WHITE
		if actor.cursed and battle!=null:party_labels[member.id].text+=("\nСвязь %d%%" if compact else "\nСвязь с отрядом: %d%%")%roundi(battle.compatibility(actor.mutation)*100)
	for voice in voice_bars:
		voice_bars[voice].text=str(campaign.pressure[voice])+" / 100"
		voice_meters[voice].value=campaign.pressure[voice]
		voice_labels[voice].modulate=Color("e5a18c") if campaign.pressure[voice]>=50 else Color.WHITE
	voice_box.visible=not is_battle
	queue_label.text="ОЧЕРЕДЬ\n"+" → ".join(battle.queue_names()) if is_battle else "ЗАПАСЫ\n%d монет · %d припасов\nДоверие спутников: %d"%[campaign.coins,campaign.supplies,campaign.trust]
	var intentions: Array=[]
	if is_battle:
		for enemy in battle.alive_enemies():
			var intent=battle.intent(enemy)
			if not intent.is_empty():intentions.append(intent.text)
	intent_label.text="НАМЕРЕНИЯ\n"+"\n".join(intentions) if is_battle else "ЗАЦЕПКА\n"+("Подлинник найден. Решите судьбу лечебницы." if campaign.flags.get("archive_read",false) else "Сверьте показания и записи, затем доберитесь до архива.")
	action_row.visible=is_battle
	if is_battle:
		var actor=battle.active_unit()
		objective_label.text="%s · %d ОД · %s"%[actor.name,actor.ap,battle.encounter.objective]
		for id in action_buttons:
			action_buttons[id].disabled=busy or battle.status!="playing" or (actor.ap<=0 and id!="end")
			action_buttons[id].modulate=Color("edc684") if id==mode else Color.WHITE
		action_buttons.transform.disabled=action_buttons.transform.disabled or not actor.cursed or actor.mutation>=2
		var names={"investigator":"Дознаватель","executioner":"Палач","judge":"Судья","bandit":"Бандит"}
		var skills={"investigator":"Выявить [1 ОД]","executioner":"Приговор [2 ОД]","judge":"Обязать [1 ОД]","bandit":"Грязный удар [1 ОД]"}
		action_buttons.voice.text="Голос: "+str(names[battle.selected_voice])+" · Tab"
		action_buttons.voice.visible=actor.id=="hero"
		action_buttons.skill.text="3 · "+(str(skills[battle.selected_voice]) if actor.id=="hero" else "Связка [1 ОД]" if actor.id=="mira" else "Перевязка [1 ОД]")
	else:
		objective_label.text="ИМЯ, КОТОРОГО НЕТ · "+("Эпизод завершён. Можно продолжить исследование или начать заново." if not campaign.ending.is_empty() else "Найдите след человека, чья подпись стоит в протоколе вашей казни.")
		status_label.text="ЛКМ — идти / взаимодействовать · Колесо — масштаб · Средняя кнопка / WASD — камера · Shift — бег · M — карта · J — хроника · F5 / F9 — сохранить / загрузить"

func show_message(text: String) -> void:
	status_label.text=text

func modal_visible() -> bool:
	return modal_layer!=null and modal_layer.visible

func _clear_modal() -> void:
	region_mode=false;region_map=null
	for child in modal_content.get_children():
		modal_content.remove_child(child);child.queue_free()
	choice_buttons.clear()
	_responsive()

func show_dialogue(data: Dictionary) -> void:
	_clear_modal();takeover=data.get("takeover",false)
	var header=HBoxContainer.new();header.add_theme_constant_override("separation",18);modal_content.add_child(header)
	var key=str(data.get("voice",""))
	var faces={"Ирма":"witness","Архивариус":"archivist","Перевозчик":"market","Привратник":"guard","Смотритель":"warden","Спутники":"hero"}
	if key.is_empty():key=str(faces.get(data.speaker,""))
	var texture=art.portrait(key)
	if texture!=null:
		var frame=PanelContainer.new();frame.add_theme_stylebox_override("panel",_style(Color("0e131b"),Color("8e7356"),2));header.add_child(frame)
		var portrait=TextureRect.new();portrait.name="DialoguePortrait";portrait.texture=texture;portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;portrait.custom_minimum_size=Vector2(84,94);frame.add_child(portrait)
	else:
		var seal=Sigil.new();seal.blood=takeover;seal.custom_minimum_size=Vector2(58,70);header.add_child(seal)
	var titles=VBoxContainer.new();titles.size_flags_horizontal=Control.SIZE_EXPAND_FILL;titles.size_flags_vertical=Control.SIZE_SHRINK_CENTER;titles.add_theme_constant_override("separation",7);header.add_child(titles)
	titles.add_child(_label("Ч У Ж А Я   В О Л Я" if takeover else "ХРОНИКА И ПОКАЗАНИЯ",10,Color("b3777b") if takeover else Color("8d98a2")))
	var speaker=_wrap(data.speaker.to_upper(),22,Color("db9c99") if takeover else Color("dfc9a2"));speaker.add_theme_font_override("font",title_font);titles.add_child(speaker)
	modal_content.add_child(HSeparator.new())
	modal_content.add_child(_wrap(data.text,17,Color("d0cec7")))
	for option in data.choices:
		var id: String=option.id
		var button=_button("›  "+option.label);button.alignment=HORIZONTAL_ALIGNMENT_LEFT;button.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;button.custom_minimum_size.y=44;button.add_theme_font_size_override("font_size",14)
		button.pressed.connect(func():choice_selected.emit(id));modal_content.add_child(button);choice_buttons[id]=button
	modal_layer.show()

func show_document(title: String,text: String,options: Array=[]) -> void:
	var choices=options if not options.is_empty() else [{"id":"close_panel","label":"Вернуться"}]
	show_dialogue({"speaker":title,"text":text,"choices":choices,"takeover":false})

func close_modal() -> void:
	modal_layer.hide();takeover=false

func show_region(campaign) -> void:
	_clear_modal();region_mode=true;takeover=false
	modal_content.add_child(_label("ВЕЛЬСКИЙ УЕЗД",22,Color("d9c9a9")))
	region_map=load("res://scripts/view/region_map.gd").new();region_map.campaign=campaign
	region_map.custom_minimum_size=Vector2(400,minf(450,get_viewport_rect().size.y-320))
	region_map.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	region_map.destination_selected.connect(func(point):region_destination.emit(point))
	modal_content.add_child(region_map)
	var row=HFlowContainer.new();row.add_theme_constant_override("h_separation",6);modal_content.add_child(row)
	for camp in campaign.layout.camps():
		if not campaign.discovered.has(camp.id):continue
		var id:String=camp.id;var button=_button(camp.name+" · 1 припас")
		button.tooltip_text="Переход между открытыми лагерями доступен из лагеря, вне боя."
		button.pressed.connect(func():region_travel.emit(id));row.add_child(button)
	var close=_button("Вернуться · M / Esc");close.pressed.connect(close_modal);modal_content.add_child(close)
	_responsive();modal_layer.show()

func show_region_notice(text: String) -> void:
	if region_map!=null:
		region_map.notice=text;region_map.queue_redraw()
	show_message(text)
