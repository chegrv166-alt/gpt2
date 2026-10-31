extends VBoxContainer

signal choice_selected(id: String)
signal action_selected(id: String)
signal save_requested
signal load_requested
signal retreat_requested
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
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_theme_constant_override("separation",0)
	body_font=load("res://assets/body.ttf");title_font=load("res://assets/title.ttf")
	var custom=Theme.new();custom.default_font=body_font;custom.default_font_size=15
	var normal=_style(Color("1c2a27"),Color("5b6451"),8)
	var hover=_style(Color("344037"),Color("b3a077"),8)
	var pressed=_style(Color("4a4434"),Color("d4ba86"),8)
	custom.set_stylebox("normal","Button",normal);custom.set_stylebox("hover","Button",hover);custom.set_stylebox("pressed","Button",pressed)
	custom.set_stylebox("focus","Button",_style(Color(0,0,0,0),Color("c6b181"),8))
	custom.set_stylebox("disabled","Button",_style(Color("151f1d"),Color("343f34"),8))
	custom.set_color("font_color","Button",Color("d2ceba"));custom.set_color("font_disabled_color","Button",Color("687361"))
	custom.set_color("font_color","Label",Color("d3cdb8"));theme=custom
	_build_header()
	var center=HBoxContainer.new();center.size_flags_vertical=Control.SIZE_EXPAND_FILL;center.add_theme_constant_override("separation",0);add_child(center)
	board_slot=Control.new();board_slot.name="BoardSlot";board_slot.size_flags_horizontal=Control.SIZE_EXPAND_FILL;board_slot.size_flags_vertical=Control.SIZE_EXPAND_FILL;center.add_child(board_slot)
	sidebar=PanelContainer.new();sidebar.name="Sidebar";sidebar.custom_minimum_size=Vector2(280,0);sidebar.add_theme_stylebox_override("panel",_style(Color("131e1b"),Color("384538"),16));center.add_child(sidebar)
	var scroller=ScrollContainer.new();scroller.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;sidebar.add_child(scroller)
	sidebar_box=VBoxContainer.new();sidebar_box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;sidebar_box.add_theme_constant_override("separation",12);scroller.add_child(sidebar_box)
	_section(sidebar_box,"ОТРЯД")
	for item in [["hero","ХРОНИСТ","Проводник · проклятие"],["mira","МИРРА","Стрелок · без проклятия"],["sava","САВА","Лекарь · проклятие"]]:
		var card=PanelContainer.new();card.add_theme_stylebox_override("panel",_style(Color("1c2822"),Color("374435"),10));sidebar_box.add_child(card)
		var column=VBoxContainer.new();column.add_theme_constant_override("separation",6);card.add_child(column)
		var name_label=_label(item[1],16,Color("d8c69f"));column.add_child(name_label)
		column.add_child(_label(item[2],12,Color("929d84")))
		var bar=ProgressBar.new();bar.show_percentage=false;bar.custom_minimum_size.y=7;bar.add_theme_stylebox_override("background",_style(Color("111b18"),Color("111b18"),0));bar.add_theme_stylebox_override("fill",_style(Color("8e9f70"),Color("8e9f70"),0));column.add_child(bar);party_bars[item[0]]=bar
		var detail=_label("",12,Color("adb49b"));column.add_child(detail);party_labels[item[0]]=detail
	voice_box=VBoxContainer.new();voice_box.add_theme_constant_override("separation",7);sidebar_box.add_child(voice_box)
	_section(voice_box,"ЧУЖОЕ ПРИСУТСТВИЕ")
	for voice in [["investigator","Дознаватель"],["executioner","Палач"],["judge","Судья"],["bandit","Бандит"]]:
		var row=HBoxContainer.new();voice_box.add_child(row)
		var label=_label(voice[1],12,Color("afa494"));label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;row.add_child(label);voice_labels[voice[0]]=label
		var value=_label("",12,Color("c58f7b"));row.add_child(value);voice_bars[voice[0]]=value
	voice_box.add_child(_wrap("От 50: знакомый человек или место может вызвать перехват разговора.",11,Color("7e8b76")))
	queue_label=_wrap("",13,Color("c1ba9f"));sidebar_box.add_child(queue_label)
	intent_label=_wrap("",12,Color("a79c89"));sidebar_box.add_child(intent_label)
	bottom=PanelContainer.new();bottom.custom_minimum_size.y=136;bottom.add_theme_stylebox_override("panel",_style(Color("15211d"),Color("434f3e"),16));add_child(bottom)
	var bottom_box=VBoxContainer.new();bottom_box.add_theme_constant_override("separation",10);bottom.add_child(bottom_box)
	objective_label=_wrap("",14,Color("c5b387"));bottom_box.add_child(objective_label)
	action_row=HFlowContainer.new();action_row.add_theme_constant_override("h_separation",7);action_row.add_theme_constant_override("v_separation",6);bottom_box.add_child(action_row)
	for item in [["voice","Голос · Tab"],["move","1 · Шаг"],["attack","2 · Удар"],["skill","3 · Приём"],["transform","4 · Обращение"],["guard","5 · Прикрыться"],["interact","E · Механизм"],["end","Пробел · Завершить"]]:
		var id: String=item[0]
		var button=_button(item[1]);button.custom_minimum_size.y=37;button.pressed.connect(func():action_selected.emit(id));action_row.add_child(button);action_buttons[id]=button
	status_label=_label("",12,Color("8f9d84"));bottom_box.add_child(status_label)
	_build_modal()

func _build_header() -> void:
	var panel=PanelContainer.new();panel.custom_minimum_size.y=64;panel.add_theme_stylebox_override("panel",_style(Color("101916"),Color("424c3b"),15));add_child(panel)
	var row=HBoxContainer.new();row.add_theme_constant_override("separation",10);panel.add_child(row)
	var logo=_label("ASHEN COVENANT",21,Color("d0b887"));logo.add_theme_font_override("font",title_font);logo.size_flags_horizontal=Control.SIZE_EXPAND_FILL;row.add_child(logo)
	journal_button=_button("Хроника · J");journal_button.pressed.connect(func():journal_requested.emit());row.add_child(journal_button)
	var save=_button("Сохранить · F5");save.pressed.connect(func():save_requested.emit());row.add_child(save)
	var restore=_button("Загрузить · F9");restore.pressed.connect(func():load_requested.emit());row.add_child(restore)
	var restart=_button("Новый эпизод");restart.pressed.connect(func():new_requested.emit());row.add_child(restart)

func _build_modal() -> void:
	modal_layer=Control.new();modal_layer.name="Modal";modal_layer.theme=theme;modal_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);modal_layer.mouse_filter=Control.MOUSE_FILTER_STOP;modal_layer.z_index=50
	get_parent().add_child.call_deferred(modal_layer)
	var shade=ColorRect.new();shade.color=Color(.015,.025,.023,.86);shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);shade.mouse_filter=Control.MOUSE_FILTER_STOP;modal_layer.add_child(shade)
	var margin=MarginContainer.new();margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);margin.add_theme_constant_override("margin_left",30);margin.add_theme_constant_override("margin_right",30);margin.add_theme_constant_override("margin_top",25);margin.add_theme_constant_override("margin_bottom",25);modal_layer.add_child(margin)
	var center=CenterContainer.new();center.size_flags_horizontal=Control.SIZE_EXPAND_FILL;center.size_flags_vertical=Control.SIZE_EXPAND_FILL;margin.add_child(center)
	modal_panel=PanelContainer.new();modal_panel.custom_minimum_size=Vector2(760,0);modal_panel.add_theme_stylebox_override("panel",_style(Color("1a2520"),Color("a08a61"),26));center.add_child(modal_panel)
	var scroll=ScrollContainer.new();scroll.custom_minimum_size=Vector2(0,250);scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;modal_panel.add_child(scroll)
	modal_content=VBoxContainer.new();modal_content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;modal_content.add_theme_constant_override("separation",14);scroll.add_child(modal_content)
	modal_layer.hide()

func _style(bg: Color,border: Color,padding: int) -> StyleBoxFlat:
	var box=StyleBoxFlat.new();box.bg_color=bg;box.border_color=border;box.set_border_width_all(1);box.set_content_margin_all(padding);box.set_corner_radius_all(2);return box

func _label(text: String,font_size: int,color: Color) -> Label:
	var label=Label.new();label.text=text;label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",color);return label

func _wrap(text: String,font_size: int,color: Color) -> Label:
	var label=_label(text,font_size,color);label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;return label

func _button(text: String) -> Button:
	var button=Button.new();button.text=text;button.mouse_default_cursor_shape=Control.CURSOR_POINTING_HAND;return button

func _section(parent: Node,text: String) -> void:
	var label=_label(text,12,Color("9f9674"));parent.add_child(label)

func update_state(campaign,battle,mode: String,busy: bool=false) -> void:
	is_battle=battle!=null
	compact=size.x<1150
	sidebar.custom_minimum_size.x=235 if compact else 280
	for member in campaign.party:
		var actor=battle.unit(member.id) if battle!=null else member
		party_bars[member.id].max_value=actor.max_hp;party_bars[member.id].value=actor.hp
		party_labels[member.id].text="%d / %d HP%s"%[actor.hp,actor.max_hp," · Обращение %d"%actor.mutation if actor.cursed else ""]
		if actor.cursed and battle!=null:party_labels[member.id].text+="\nСвязь с отрядом: %d%%"%roundi(battle.compatibility(actor.mutation)*100)
	for voice in voice_bars:
		voice_bars[voice].text=str(campaign.pressure[voice])+" / 100"
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
		status_label.text="ЛКМ — идти / взаимодействовать · Колесо — масштаб · Средняя кнопка / WASD — камера · J — хроника · F5 / F9 — сохранить / загрузить"

func show_message(text: String) -> void:
	status_label.text=text

func modal_visible() -> bool:
	return modal_layer!=null and modal_layer.visible

func _clear_modal() -> void:
	for child in modal_content.get_children():
		modal_content.remove_child(child);child.queue_free()
	choice_buttons.clear()
	modal_panel.custom_minimum_size.x=minf(760,get_viewport_rect().size.x-60)
	var scroll=modal_content.get_parent() as ScrollContainer
	scroll.custom_minimum_size.y=minf(560,get_viewport_rect().size.y-120)

func show_dialogue(data: Dictionary) -> void:
	_clear_modal();takeover=data.get("takeover",false)
	var speaker=_label(data.speaker.to_upper(),20,Color("d58e79") if takeover else Color("d6bd8b"));speaker.add_theme_font_override("font",title_font);speaker.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;modal_content.add_child(speaker)
	modal_content.add_child(_wrap(data.text,17,Color("d6d2be")))
	for option in data.choices:
		var id: String=option.id
		var button=_button(option.label);button.alignment=HORIZONTAL_ALIGNMENT_LEFT;button.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;button.custom_minimum_size.y=46
		button.pressed.connect(func():choice_selected.emit(id));modal_content.add_child(button);choice_buttons[id]=button
	modal_layer.show()

func show_document(title: String,text: String,options: Array=[]) -> void:
	var choices=options if not options.is_empty() else [{"id":"close_panel","label":"Вернуться"}]
	show_dialogue({"speaker":title,"text":text,"choices":choices,"takeover":false})

func close_modal() -> void:
	modal_layer.hide();takeover=false
