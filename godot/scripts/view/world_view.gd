extends Control

signal location_selected(id: String)
signal tile_selected(tile: Vector2i)
const Data=preload("res://scripts/model/episode_data.gd")
const Art=preload("res://scripts/view/art_library.gd")
var art=Art.new()
var campaign=null
var battle=null
var mode="move"
var hover=Vector2i(-1,-1)
var zoom=0.92
var pan=Vector2.ZERO
var camera_focus=Vector2(7,18)
var drag=false
var navigation=AStarGrid2D.new()
var route: Array=[]
var pending_location=""
var player=Vector2(7,18)
var drawn_units: Dictionary={}
var floaters: Array=[]
var flashes: Dictionary={}
var elapsed=0.0
var font: Font
var title_font: Font
var selection=""
var _initialized=false
var reachable: Dictionary={}
var hovered_location=""
var ground_material: ShaderMaterial
var mist_material: ShaderMaterial
var glow_texture: GradientTexture2D
var scenery: Array=[]

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	clip_contents=true
	font=load("res://assets/body.ttf")
	title_font=load("res://assets/title.ttf")
	_build_atmosphere()
	navigation.region=Rect2i(0,0,30,24)
	navigation.cell_size=Vector2.ONE
	navigation.diagonal_mode=AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	navigation.update()
	for location in Data.locations():
		if location.kind in ["camp","memorial","market"]:continue
		var p=Vector2i(int(location.pos[0]),int(location.pos[1]))
		for y in range(p.y-1,p.y+2):
			for x in range(p.x-1,p.x+2):navigation.set_point_solid(Vector2i(x,y))
	_create_scenery()
	resized.connect(_on_resize)

func configure(state,new_battle=null) -> void:
	campaign=state
	var changed=battle!=new_battle
	battle=new_battle
	if battle==null:
		player=Vector2(float(campaign.world_position[0]),float(campaign.world_position[1]))
		if changed or not _initialized:
			zoom=.85 if size.x>=1000 else .92
			_center_on(Vector2(14,12) if not _initialized and size.x>=1000 else player)
	else:
		route.clear();pending_location=""
		if changed:
			zoom=maxf(.56,minf(1.15,minf((size.x-70)/850.0,(size.y-95)/440.0)))
			_center_on(Vector2(6.5,5.5));drawn_units.clear()
	reachable=battle.reachable_tiles(battle.active_id) if battle!=null else {}
	_initialized=true
	queue_redraw()

func _on_resize() -> void:
	if not _initialized:return
	if battle!=null:zoom=maxf(.56,minf(1.15,minf((size.x-70)/850.0,(size.y-95)/440.0)))
	_center_on(Vector2(6.5,5.5) if battle!=null else (camera_focus if size.x>=1000 else player))

func _iso(tile: Vector2) -> Vector2:
	return Vector2((tile.x-tile.y)*32.0,(tile.x+tile.y)*16.0)

func screen(tile: Vector2) -> Vector2:
	return _iso(tile)*zoom+pan+size*0.5

func ground(pos: Vector2) -> Vector2:
	var local=(pos-pan-size*0.5)/zoom
	return Vector2((local.x/32.0+local.y/16.0)*0.5,(local.y/16.0-local.x/32.0)*0.5)

func _center_on(tile: Vector2) -> void:
	camera_focus=tile
	pan=-_iso(tile)*zoom+Vector2(0,60 if battle==null else 38)

func _process(delta: float) -> void:
	elapsed+=delta
	if not route.is_empty() and battle==null:
		var target=Vector2(route[0])
		player=player.move_toward(target,delta*5.0)
		camera_focus=player
		pan=pan.lerp(-_iso(player)*zoom+Vector2(0,60),1.0-exp(-delta*3.0))
		if player.distance_to(target)<0.015:
			route.pop_front()
			campaign.world_position=[int(target.x),int(target.y)]
			if route.is_empty() and not pending_location.is_empty():
				var id=pending_location;pending_location="";location_selected.emit(id)
	if battle!=null:
		for actor in battle.units:
			var wanted=Vector2(float(actor.pos[0]),float(actor.pos[1]))
			if not drawn_units.has(actor.id):drawn_units[actor.id]=wanted
			drawn_units[actor.id]=drawn_units[actor.id].lerp(wanted,1.0-exp(-delta*11.0))
	for item in floaters:item.life-=delta;item.y-=delta*25.0
	floaters=floaters.filter(func(f):return f.life>0)
	for key in flashes:flashes[key]=maxf(0.0,float(flashes[key])-delta)
	ground_material.set_shader_parameter("board_size",size)
	ground_material.set_shader_parameter("camera_pan",pan)
	ground_material.set_shader_parameter("camera_zoom",zoom)
	ground_material.set_shader_parameter("battle_mode",battle!=null)
	mist_material.set_shader_parameter("aspect",size.x/maxf(1,size.y))
	queue_redraw()

func feedback(events: Array) -> void:
	for event in events:
		if event.type in ["damage","heal","transform"]:
			var actor=battle.unit(event.id) if battle!=null else {}
			if actor.is_empty():continue
			var p=screen(Vector2(float(actor.pos[0]),float(actor.pos[1])))
			floaters.append({"x":p.x,"y":p.y-80*zoom,"life":1.0,"text":("−" if event.type=="damage" else "+" if event.type=="heal" else "ОБРАЩЕНИЕ ")+str(event.get("amount",0)),"color":Color("e4a179") if event.type=="damage" else Color("c5d2a0")})
			flashes[event.id]=0.28

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		if drag:
			pan+=event.relative;camera_focus=ground(size*.5+Vector2(0,60))
		var p=ground(event.position);hover=Vector2i(roundi(p.x),roundi(p.y))
		hovered_location=_location_at(event.position) if battle==null else ""
		mouse_default_cursor_shape=Control.CURSOR_POINTING_HAND if not hovered_location.is_empty() else Control.CURSOR_ARROW
	if event is InputEventMouseButton:
		if event.button_index==MOUSE_BUTTON_MIDDLE:drag=event.pressed
		if not event.pressed:return
		if event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
			var before=ground(event.position)
			zoom=clampf(zoom*(1.1 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 0.91),0.5,1.7)
			pan=event.position-size*0.5-_iso(before)*zoom
			camera_focus=ground(size*.5+Vector2(0,60))
		elif event.button_index==MOUSE_BUTTON_LEFT:
			if battle!=null:
				var tile=ground(event.position)
				var clicked=Vector2i(roundi(tile.x),roundi(tile.y))
				if mode in ["attack","skill"]:
					var targets=_battle_draw_items()
					targets.reverse()
					for entry in targets:
						if entry.type!="actor":continue
						var actor=entry.item
						var position:Vector2=entry.point
						if actor.hp>0 and art.hit(art.actor_key(actor),actor_rect(actor,screen(position)),event.position):
							clicked=battle.point(actor);break
				tile_selected.emit(clicked)
			else:_explore_click(event.position)
	accept_event()

func _explore_click(pos: Vector2) -> void:
	var hit=_location_at(pos)
	var target=Vector2i(roundi(ground(pos).x),roundi(ground(pos).y))
	if not hit.is_empty():
		for location in Data.locations():
			if location.id==hit:target=Vector2i(int(location.pos[0]),int(location.pos[1])+2)
	if not navigation.region.has_point(target) or navigation.is_point_solid(target):return
	var from=Vector2i(roundi(player.x),roundi(player.y))
	var path=navigation.get_id_path(from,target)
	if path.is_empty():return
	route=Array(path);pending_location=hit;selection=hit
	if not route.is_empty() and Vector2(route[0]).distance_to(player)<0.1:route.pop_front()
	if route.is_empty() and not pending_location.is_empty():
		var id=pending_location;pending_location="";location_selected.emit(id)

func pan_camera(axis: Vector2,delta: float) -> void:
	if not axis.is_zero_approx():
		pan-=axis*delta*420;camera_focus=ground(size*.5+Vector2(0,60))

func _poly(points: Array,color: Color) -> void:
	draw_colored_polygon(PackedVector2Array(points),color)

func _build_atmosphere() -> void:
	var floor=ColorRect.new();floor.mouse_filter=Control.MOUSE_FILTER_IGNORE
	floor.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);floor.show_behind_parent=true;floor.z_index=-1
	ground_material=ShaderMaterial.new();ground_material.shader=load("res://scripts/view/ground.gdshader")
	ground_material.set_shader_parameter("terrain",load("res://assets/painted/terrain.png"));floor.material=ground_material;add_child(floor)
	var mist=ColorRect.new();mist.mouse_filter=Control.MOUSE_FILTER_IGNORE
	mist.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mist_material=ShaderMaterial.new();mist_material.shader=load("res://scripts/view/atmosphere.gdshader");mist.material=mist_material;add_child(mist)
	var gradient=Gradient.new();gradient.set_color(0,Color(1,1,1,.65));gradient.set_color(1,Color(1,1,1,0))
	glow_texture=GradientTexture2D.new();glow_texture.gradient=gradient;glow_texture.width=128;glow_texture.height=128
	glow_texture.fill=GradientTexture2D.FILL_RADIAL;glow_texture.fill_from=Vector2(.5,.5);glow_texture.fill_to=Vector2(1,.5)

func _create_scenery() -> void:
	for i in range(36):
		var tile=Vector2(posmod(i*17+2,43)-6,posmod(i*13+1,35)-5)
		if _road_distance(tile)<2.5:continue
		var near=false
		for place in Data.locations():
			if tile.distance_to(Vector2(place.pos[0],place.pos[1]))<3.2:near=true;break
		if not near:scenery.append({"point":tile,"key":"tree" if i%3 else "tree_pale","scale":.68+float(i%5)*.06})
	for point in [Vector2(-2,8),Vector2(-2,13),Vector2(-2,19),Vector2(2,25),Vector2(8,26),Vector2(15,26),Vector2(1,-2),Vector2(8,-2),Vector2(19,-2),Vector2(32,15)]:
		scenery.append({"point":point,"key":"house","scale":1.0})

func _road_distance(p: Vector2) -> float:
	var segments=[[Vector2(3,12.5),Vector2(26,12.5)],[Vector2(7,12.5),Vector2(7,19)],[Vector2(16.5,4),Vector2(16.5,18)],[Vector2(9,7),Vector2(26,7)],[Vector2(12,17),Vector2(22,17)]]
	var nearest=100.0
	for line in segments:nearest=minf(nearest,p.distance_to(Geometry2D.get_closest_point_to_segment(p,line[0],line[1])))
	return nearest

func location_rect(location: Dictionary) -> Rect2:
	return art.rect(location.kind,screen(Vector2(location.pos[0],location.pos[1])),zoom)
func actor_rect(actor: Dictionary,foot: Vector2) -> Rect2:
	return art.rect(art.actor_key(actor),foot,zoom)
func _label_rect(place: Dictionary) -> Rect2:
	var p=screen(Vector2(place.pos[0],place.pos[1]))
	var width=font.get_string_size(place.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12).x+20
	return Rect2(p+Vector2(-width*.5,16),Vector2(width,26))
func _location_at(pos: Vector2) -> String:
	var places=Data.locations()
	places.sort_custom(func(a,b):return a.pos[0]+a.pos[1]>b.pos[0]+b.pos[1])
	for place in places:
		var labelled=player.distance_to(Vector2(place.pos[0],place.pos[1]))<7.5 or place.id in [selection,hovered_location]
		if labelled and _label_rect(place).has_point(pos):return place.id
		if art.hit(place.kind,location_rect(place),pos):return place.id
	return ""

func _draw() -> void:
	if campaign==null or font==null:return
	if battle==null:_draw_settlement()
	else:_draw_battle()
	for f in floaters:
		var color:Color=f.color;color.a=clampf(f.life*2,0,1)
		draw_string_outline(font,Vector2(f.x-20,f.y),f.text,HORIZONTAL_ALIGNMENT_LEFT,-1,18,3,Color("15171c"))
		draw_string(font,Vector2(f.x-20,f.y),f.text,HORIZONTAL_ALIGNMENT_LEFT,-1,18,color)
	for i in range(28):
		var p=Vector2(fposmod(float(i*137)+elapsed*(3+i%4),maxf(1,size.x)),fposmod(float(i*79)-elapsed*(7+i%5),maxf(1,size.y)))
		draw_line(p,p+Vector2(.7,1.6),Color(.75,.8,.84,.07+float(i%3)*.025),1,true)
	if battle==null:_draw_minimap()

func _visible(rect: Rect2) -> bool:
	return rect.intersects(Rect2(Vector2.ZERO,size).grow(10))
func _glow(point: Vector2,radius: float,color: Color) -> void:
	draw_texture_rect(glow_texture,Rect2(point-Vector2.ONE*radius,Vector2.ONE*radius*2),false,color)
func _shadow(point: Vector2,width: float,alpha: float=.25) -> void:
	draw_set_transform(point,0,Vector2(1,.38));draw_circle(Vector2.ZERO,width,Color(0,0,0,alpha));draw_set_transform(Vector2.ZERO)
func _scenery_sprite(key: String,tile: Vector2,scale: float=1.0) -> void:
	var p=screen(tile);var rect=art.rect(key,p,zoom*scale)
	if not _visible(rect):return
	var tint=Color(.77,.82,.9,.85)
	if battle==null:
		for i in range(3):
			var unit=player+Vector2(-i*.95,i*.6)
			if rect.has_point(screen(unit)-Vector2(0,45)*zoom) and tile.x+tile.y>unit.x+unit.y:tint.a=.25
	else:
		for member in battle.allies():
			var position:Vector2=drawn_units.get(member.id,Vector2(member.pos[0],member.pos[1]))
			if member.hp>0 and rect.has_point(screen(position)-Vector2(0,45)*zoom) and tile.x+tile.y>position.x+position.y:tint.a=.25
	_shadow(p,rect.size.x*.3,.2);draw_texture_rect(art.texture(key),rect,false,tint)

func _draw_settlement() -> void:
	var items: Array=[]
	for item in scenery:items.append({"depth":item.point.x+item.point.y,"type":"scenery","item":item})
	for place in Data.locations():items.append({"depth":float(place.pos[0]+place.pos[1]),"type":"location","item":place})
	for i in range(3):
		var p=player+Vector2(-i*.95,i*.6)
		items.append({"depth":p.x+p.y,"type":"actor","item":campaign.party[i],"point":p})
	items.sort_custom(func(a,b):return a.depth<b.depth)
	for item in items:
		match item.type:
			"location":_building(item.item)
			"scenery":_scenery_sprite(item.item.key,item.item.point,item.item.scale)
			"actor":_actor(item.item,screen(item.point),item.item.id=="hero",not route.is_empty())
	if not route.is_empty():
		var points=PackedVector2Array([screen(player)])
		for p in route:points.append(screen(Vector2(p)))
		draw_polyline(points,Color(.77,.7,.51,.45),1.2,true)
		_mark(screen(Vector2(route.back())),12,Color("b9a67e"))
	for place in Data.locations():
		var rect=_label_rect(place)
		if not _visible(rect):continue
		var active=place.id in [selection,hovered_location]
		var near=player.distance_to(Vector2(place.pos[0],place.pos[1]))<7.5
		var p=screen(Vector2(place.pos[0],place.pos[1]))
		_mark(p+Vector2(0,13),3,Color("bba783") if active else Color("7e888d"))
		if not near and not active:continue
		draw_rect(rect,Color(.055,.064,.079,.8 if active else .55))
		draw_string(font,rect.position+Vector2(10,17),place.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12,Color("e3d3b4") if active else Color("b9bab9"))
		if active:
			draw_line(rect.position+Vector2(8,rect.size.y),rect.end-Vector2(8,0),Color("89724d"),1,true)
			var width=font.get_string_size(place.subtitle,HORIZONTAL_ALIGNMENT_LEFT,-1,11).x
			draw_string_outline(font,p+Vector2(-width*.5,58),place.subtitle,HORIZONTAL_ALIGNMENT_LEFT,-1,11,3,Color("14171c"))
			draw_string(font,p+Vector2(-width*.5,58),place.subtitle,HORIZONTAL_ALIGNMENT_LEFT,-1,11,Color("d0bf9d"))
	_draw_heading("В Е Л Ь","Пограничный уезд · Последняя запись")

func _building(place: Dictionary) -> void:
	var rect=location_rect(place)
	if not _visible(rect):return
	var p=screen(Vector2(place.pos[0],place.pos[1]));_shadow(p,rect.size.x*.38,.28)
	var tint=Color(1.05,1.06,1.1)
	for i in range(3):
		var unit=player+Vector2(-i*.95,i*.6)
		if place.pos[0]+place.pos[1]>unit.x+unit.y and rect.has_point(screen(unit)-Vector2(0,45)*zoom):tint.a=.35
	if place.id==hovered_location:tint=Color(1.2,1.15,1.08,tint.a)
	draw_texture_rect(art.texture(place.kind),rect,false,tint)
	if place.kind=="camp":
		_glow(p-Vector2(0,14)*zoom,95*zoom,Color(1,.46,.15,.4+sin(elapsed*4)*.03))
		for i in range(7):
			var phase=fmod(elapsed*.5+i*.17,1)
			draw_circle(p+Vector2(sin(elapsed+i)*8,-phase*52-12)*zoom,(1-phase)*1.3,Color(1,.58,.25,(1-phase)*.6))
	elif place.kind in ["house","archive","chapel","gate","market","memorial"]:_glow(p+Vector2(-10,-25)*zoom,50*zoom,Color(.94,.55,.22,.16))
	elif place.kind=="infirmary":_glow(p-Vector2(0,110)*zoom,80*zoom,Color(.7,.16,.19,.13+sin(elapsed)*.035))

func _actor(actor: Dictionary,p: Vector2,selected: bool,moving: bool=false) -> void:
	var dead=actor.hp<=0;var level=int(actor.get("mutation",0));var ally=actor.team=="ally"
	_shadow(p,(20+level*7)*zoom,.4)
	if selected:
		draw_set_transform(p,0,Vector2(1,.48));draw_arc(Vector2.ZERO,(26+level*6)*zoom,0,TAU,48,Color("ccbc94"),1.6,true);draw_set_transform(Vector2.ZERO)
		_mark(p+Vector2(0,13)*zoom,3,Color("ddd2b7"))
	var key=art.actor_key(actor);var rect=actor_rect(actor,p)
	var phase=elapsed*(8 if moving else 1.8)+float(str(actor.id).hash()%17)
	rect.position.x+=sin(phase)*(.9 if moving else .25)*zoom
	rect.position.y-=absf(sin(phase))*(2.6 if moving else .55)*zoom
	var tint=Color(1.13,1.14,1.15) if ally else Color(.97,.95,.95)
	if dead:tint=Color(.38,.37,.4,.48)
	if float(flashes.get(actor.id,0))>0:tint=Color(1.5,1.25,1.12)
	if dead:
		draw_set_transform(p,.95,Vector2(1,.6));draw_texture_rect(art.texture(key),Rect2(Vector2(-rect.size.x*.5,-rect.size.y*.3),rect.size*.7),false,tint);draw_set_transform(Vector2.ZERO);return
	draw_texture_rect(art.texture(key),rect,false,tint)
	if level>0:_glow(p-Vector2(0,34)*zoom,38*zoom,Color(.5,.14,.2,.09))
	if float(flashes.get(actor.id,0))>0:
		var fade=float(flashes[actor.id])/.28
		draw_arc(p-Vector2(0,50)*zoom,34*zoom,-1.1,1.2,24,Color(.9,.68,.52,fade*.8),2*zoom,true)
	if battle!=null:
		var bar=rect.position+Vector2((rect.size.x-48*zoom)*.5,-8)
		draw_rect(Rect2(bar-Vector2.ONE,Vector2(50*zoom,5)),Color("11151b"))
		draw_rect(Rect2(bar,Vector2(48*zoom*float(actor.hp)/actor.max_hp,3)),Color("a5b3b7") if ally else Color("aa6268"))
		if selected or actor.team=="enemy":
			var width=font.get_string_size(actor.name,HORIZONTAL_ALIGNMENT_LEFT,-1,11).x
			draw_string_outline(font,bar+Vector2((48*zoom-width)*.5,-6),actor.name,HORIZONTAL_ALIGNMENT_LEFT,-1,11,3,Color("11151b"))
			draw_string(font,bar+Vector2((48*zoom-width)*.5,-6),actor.name,HORIZONTAL_ALIGNMENT_LEFT,-1,11,Color("d0c9bd"))

func _diamond(tile: Vector2,color: Color,filled: bool=false) -> void:
	var p=screen(tile)
	var points=PackedVector2Array([p+Vector2(0,-16)*zoom,p+Vector2(32,0)*zoom,p+Vector2(0,16)*zoom,p+Vector2(-32,0)*zoom,p+Vector2(0,-16)*zoom])
	if filled:draw_colored_polygon(points,color)
	else:draw_polyline(points,color,1,true)

func _battle_draw_items() -> Array:
	var items: Array=[]
	for block in battle.encounter.blocks:
		items.append({"depth":float(block[0]+block[1]),"order":items.size(),"type":"cover","point":Vector2(block[0],block[1])})
	for actor in battle.units:
		var position:Vector2=drawn_units.get(actor.id,Vector2(actor.pos[0],actor.pos[1]))
		items.append({"depth":position.x+position.y,"order":items.size(),"type":"actor","point":position,"item":actor})
	items.sort_custom(func(a,b):return a.order<b.order if a.depth==b.depth else a.depth<b.depth)
	return items

func _draw_battle() -> void:
	_scenery_sprite("gate",Vector2(9,-3),1.2);_scenery_sprite("chapel",Vector2(-4,1),1.1)
	_scenery_sprite("tree",Vector2(-2,11),.85);_scenery_sprite("tree_pale",Vector2(14,9),1)
	var active=battle.active_unit()
	for y in range(int(battle.encounter.height)):
		for x in range(int(battle.encounter.width)):
			var tile=Vector2i(x,y)
			if x==0 or y==0 or x==int(battle.encounter.width)-1 or y==int(battle.encounter.height)-1:_diamond(Vector2(tile),Color(.65,.66,.62,.13))
			if mode=="move" and reachable.has(tile) and active.ap>0 and not battle.is_blocked(tile) and not battle.occupied(tile,active.id):
				_diamond(Vector2(tile),Color(.58,.67,.72,.085),true);_diamond(Vector2(tile),Color(.58,.67,.72,.14))
	for objective in battle.encounter.objectives:
		var pos=objective.pos if objective.id!="prisoner" else battle.unit("prisoner").pos
		var p=screen(Vector2(pos[0],pos[1]));var done=bool(battle.progress.get(objective.id,false));var color=Color("687d7e") if done else Color("d2b17b")
		_glow(p,42*zoom,Color(color,.16));_mark(p,18*zoom,color)
		if objective.id.begins_with("seal_"):
			for i in range(3):draw_arc(p-Vector2(0,15*i)*zoom,(23-i*5)*zoom,0,TAU,28,Color(.7,.4,.43,.7-i*.15),1.4,true)
		var width=font.get_string_size(objective.name,HORIZONTAL_ALIGNMENT_LEFT,-1,11).x
		draw_string_outline(font,p+Vector2(-width*.5,30),objective.name,HORIZONTAL_ALIGNMENT_LEFT,-1,11,3,Color("11151b"))
		draw_string(font,p+Vector2(-width*.5,30),objective.name,HORIZONTAL_ALIGNMENT_LEFT,-1,11,color)
	for item in _battle_draw_items():
		if item.type=="cover":
			var p=screen(item.point);var rect=art.rect("cover",p,zoom*.85);var alpha=1.0
			for member in battle.units:
				if member.team=="ally" and member.hp>0 and item.depth>member.pos[0]+member.pos[1] and rect.has_point(screen(Vector2(member.pos[0],member.pos[1]))-Vector2(0,40)*zoom):alpha=.38
			_shadow(p,18*zoom);draw_texture_rect(art.texture("cover"),rect,false,Color(.84,.87,.92,alpha))
		else:
			var actor=item.item;var p:Vector2=item.point
			_actor(actor,screen(p),actor.id==battle.active_id,p.distance_to(Vector2(actor.pos[0],actor.pos[1]))>.05)
	if battle.in_bounds(hover):_diamond(Vector2(hover),Color("d7b7ad") if mode in ["attack","skill"] else Color("d2c5a8"))
	_draw_heading(battle.encounter.title,"Раунд %d / %d · %s"%[battle.round_number,battle.encounter.round_limit,"Ваш ход" if battle.status=="playing" else "Столкновение завершено"])

func _mark(p: Vector2,radius: float,color: Color) -> void:
	draw_polyline(PackedVector2Array([p+Vector2(0,-radius*.5),p+Vector2(radius,0),p+Vector2(0,radius*.5),p+Vector2(-radius,0),p+Vector2(0,-radius*.5)]),color,1,true)
func _draw_heading(title: String,subtitle: String) -> void:
	draw_string_outline(title_font,Vector2(25,38),title,HORIZONTAL_ALIGNMENT_LEFT,-1,25,5,Color(.06,.08,.1,.75))
	draw_string(title_font,Vector2(25,38),title,HORIZONTAL_ALIGNMENT_LEFT,-1,25,Color("e2d4b8"))
	draw_string_outline(font,Vector2(26,61),subtitle,HORIZONTAL_ALIGNMENT_LEFT,-1,12,3,Color("11151b"))
	draw_string(font,Vector2(26,61),subtitle,HORIZONTAL_ALIGNMENT_LEFT,-1,12,Color("a6afb4"))
	draw_line(Vector2(27,76),Vector2(223,76),Color(.63,.54,.39,.5),1,true);_mark(Vector2(231,76),4,Color("8e7956"))
func _draw_minimap() -> void:
	var origin=Vector2(size.x-183,18);var base=origin+Vector2(85,36)
	draw_rect(Rect2(origin,Vector2(166,130)),Color(.045,.058,.073,.86))
	draw_rect(Rect2(origin,Vector2(166,130)),Color(.48,.45,.38,.65),false,1)
	draw_string(title_font,origin+Vector2(12,21),"КАРТА УЕЗДА",HORIZONTAL_ALIGNMENT_LEFT,-1,11,Color("b6a583"))
	draw_polyline(PackedVector2Array([base,base+Vector2(72,34),base+Vector2(14,63),base+Vector2(-58,29),base]),Color(.48,.54,.57,.5),1,true)
	for place in Data.locations():_mark(base+Vector2((place.pos[0]-place.pos[1])*2.4,(place.pos[0]+place.pos[1])*1.2),2.3,Color("b4a07e") if place.id!=selection else Color("eee0bb"))
	var p=base+Vector2((player.x-player.y)*2.4,(player.x+player.y)*1.2)
	draw_circle(p,2.5,Color("e2d8bd"));draw_arc(p,5,0,TAU,16,Color(.88,.85,.73,.5),1,true)
