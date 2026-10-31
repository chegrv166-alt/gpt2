extends Control

signal location_selected(id: String)
signal tile_selected(tile: Vector2i)
const Data=preload("res://scripts/model/episode_data.gd")
var campaign=null
var battle=null
var mode="move"
var hover=Vector2i(-1,-1)
var zoom=0.85
var pan=Vector2.ZERO
var drag=false
var navigation=AStarGrid2D.new()
var route: Array=[]
var pending_location=""
var player=Vector2(7,18)
var drawn_units: Dictionary={}
var floaters: Array=[]
var flashes: Dictionary={}
var elapsed=0.0
var textures: Dictionary={}
var floor_texture: Texture2D
var font: Font
var title_font: Font
var selection=""
var _initialized=false
var reachable: Dictionary={}

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	clip_contents=true
	font=load("res://assets/body.ttf")
	title_font=load("res://assets/title.ttf")
	for id in ["hero","mira","sava"]:textures[id]=load("res://assets/%s.png"%id)
	floor_texture=load("res://assets/materials.png")
	navigation.region=Rect2i(0,0,30,24)
	navigation.cell_size=Vector2.ONE
	navigation.diagonal_mode=AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	navigation.update()
	for location in Data.locations():
		if location.kind in ["camp","memorial","market"]:continue
		var p=Vector2i(int(location.pos[0]),int(location.pos[1]))
		for y in range(p.y-1,p.y+2):
			for x in range(p.x-1,p.x+2):navigation.set_point_solid(Vector2i(x,y))
	resized.connect(_on_resize)

func configure(state,new_battle=null) -> void:
	campaign=state
	var changed=battle!=new_battle
	battle=new_battle
	if battle==null:
		player=Vector2(float(campaign.world_position[0]),float(campaign.world_position[1]))
		if changed or not _initialized:
			zoom=0.85;_center_on(player)
	else:
		route.clear();pending_location=""
		if changed:
			zoom=minf(1.12,minf((size.x-100)/850.0,(size.y-120)/440.0))
			_center_on(Vector2(6.5,5.5));drawn_units.clear()
	reachable=battle.reachable_tiles(battle.active_id) if battle!=null else {}
	_initialized=true
	queue_redraw()

func _on_resize() -> void:
	if not _initialized:return
	_center_on(Vector2(6.5,5.5) if battle!=null else player)

func _iso(tile: Vector2) -> Vector2:
	return Vector2((tile.x-tile.y)*32.0,(tile.x+tile.y)*16.0)

func screen(tile: Vector2) -> Vector2:
	return _iso(tile)*zoom+pan+size*0.5

func ground(pos: Vector2) -> Vector2:
	var local=(pos-pan-size*0.5)/zoom
	return Vector2((local.x/32.0+local.y/16.0)*0.5,(local.y/16.0-local.x/32.0)*0.5)

func _center_on(tile: Vector2) -> void:
	pan=-_iso(tile)*zoom+Vector2(0,28)

func _process(delta: float) -> void:
	elapsed+=delta
	if not route.is_empty() and battle==null:
		var target=Vector2(route[0])
		player=player.move_toward(target,delta*5.0)
		pan=pan.lerp(-_iso(player)*zoom+Vector2(0,28),1.0-exp(-delta*3.0))
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
		if drag:pan+=event.relative
		var p=ground(event.position);hover=Vector2i(roundi(p.x),roundi(p.y))
	if event is InputEventMouseButton:
		if event.button_index==MOUSE_BUTTON_MIDDLE:drag=event.pressed
		if not event.pressed:return
		if event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
			var before=ground(event.position)
			zoom=clampf(zoom*(1.1 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 0.91),0.5,1.7)
			pan=event.position-size*0.5-_iso(before)*zoom
		elif event.button_index==MOUSE_BUTTON_LEFT:
			if battle!=null:
				var clicked=hover
				if mode in ["attack","skill"]:
					var targets=battle.units.duplicate()
					targets.sort_custom(func(a,b):return a.pos[0]+a.pos[1]>b.pos[0]+b.pos[1])
					for actor in targets:
						var foot=screen(Vector2(float(actor.pos[0]),float(actor.pos[1])))
						if actor.hp>0 and Rect2(foot-Vector2(31,88)*zoom,Vector2(62,100)*zoom).has_point(event.position):
							clicked=battle.point(actor);break
				tile_selected.emit(clicked)
			else:_explore_click(event.position)
	accept_event()

func _explore_click(pos: Vector2) -> void:
	var hit=""
	for location in Data.locations():
		var p=screen(Vector2(float(location.pos[0]),float(location.pos[1])))
		if Rect2(p-Vector2(68*zoom,105*zoom),Vector2(136*zoom,130*zoom)).has_point(pos):hit=location.id
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
	if not axis.is_zero_approx():pan-=axis*delta*420

func _poly(points: Array,color: Color) -> void:
	draw_colored_polygon(PackedVector2Array(points),color)

func _tile(p: Vector2,stone: bool,seed: int) -> void:
	var c=screen(p)
	var pts=PackedVector2Array([c+Vector2(0,-16)*zoom,c+Vector2(32,0)*zoom,c+Vector2(0,16)*zoom,c+Vector2(-32,0)*zoom])
	var tint=Color("62675a") if stone else Color("39483a")
	tint=tint.lightened(float(posmod(seed,7))*0.008)
	var uvs=PackedVector2Array([Vector2(0,0),Vector2(.5,0),Vector2(.5,.5),Vector2(0,.5)]) if stone else PackedVector2Array([Vector2(.5,.5),Vector2(1,.5),Vector2(1,1),Vector2(.5,1)])
	draw_polygon(pts,PackedColorArray([Color.WHITE,Color.WHITE,Color.WHITE,Color.WHITE]),uvs,floor_texture)
	var wash=Color("6a6d59") if stone else Color("3b4d3b")
	wash.a=.72 if stone else .58
	draw_colored_polygon(pts,wash)
	draw_polyline(PackedVector2Array([pts[0],pts[1],pts[2],pts[3],pts[0]]),Color(0.05,0.07,0.06,.3),0.7,true)
	if posmod(seed,11)==0:
		draw_line(c-Vector2(7,0)*zoom,c+Vector2(5,3)*zoom,Color("71735b")*.55,1,true)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO,size),Color("101919"))
	if campaign==null or font==null:return
	if battle==null:_draw_settlement()
	else:_draw_battle()
	for f in floaters:
		var color:Color=f.color;color.a=clampf(f.life*2,0,1)
		draw_string(font,Vector2(f.x-20,f.y),f.text,HORIZONTAL_ALIGNMENT_LEFT,-1,18,color)
	_draw_corners()
	_draw_minimap()

func _draw_settlement() -> void:
	var paths=[Vector2(5,11),Vector2(7,18),Vector2(12,17),Vector2(16,12),Vector2(17,5),Vector2(10,7),Vector2(24,7)]
	for sum_value in range(53):
		for x in range(30):
			var y=sum_value-x
			if y<0 or y>=24:continue
			var stone=(y>=11 and y<=14 and x>=3 and x<=25) or (x>=15 and x<=18 and y>=4 and y<=15)
			for point in paths:
				if Vector2(x,y).distance_to(point)<2.2:stone=true
			_tile(Vector2(x,y),stone,x*31+y*17)
	# Dark water beyond the infirmary; the same palette is used in battles.
	for i in range(10):
		var p=screen(Vector2(26+i*.17,2+i*.55))
		draw_arc(p,24*zoom,0,TAU,24,Color("233d3d"),5*zoom,true)
	var draw_items: Array=[]
	for location in Data.locations():draw_items.append({"depth":float(location.pos[0])+float(location.pos[1]),"type":"location","item":location})
	for i in range(24):
		var x=posmod(i*13+2,30);var y=posmod(i*7+1,24)
		var p=Vector2(x,y)
		var near=false
		for location in Data.locations():
			if p.distance_to(Vector2(float(location.pos[0]),float(location.pos[1])))<3:near=true
		if not near:draw_items.append({"depth":float(x+y),"type":"tree","point":p})
	draw_items.append({"depth":player.x+player.y,"type":"party"})
	draw_items.sort_custom(func(a,b):return a.depth<b.depth)
	for item in draw_items:
		if item.type=="location":_building(item.item)
		elif item.type=="tree":_tree(screen(item.point))
		else:
			for i in range(2,-1,-1):
				var p=player+Vector2(-i*.65,i*.32)
				_actor(campaign.party[i],screen(p),false,not route.is_empty())
	for location in Data.locations():
		var p=screen(Vector2(float(location.pos[0]),float(location.pos[1])))
		if p.x< -80 or p.x>size.x+80 or p.y< -100 or p.y>size.y+100:continue
		var active=selection==location.id
		if active:draw_arc(p,42*zoom,0,TAU,40,Color("c5ac77"),1.5,true)
		var label=location.name
		var width=font.get_string_size(label,HORIZONTAL_ALIGNMENT_LEFT,-1,14).x
		draw_rect(Rect2(p+Vector2(-width/2-7,13),Vector2(width+14,23)),Color(0.04,0.06,0.05,.87))
		draw_string(font,p+Vector2(-width/2,30),label,HORIZONTAL_ALIGNMENT_LEFT,-1,14,Color("c5c5ac") if not active else Color("ebd5a5"))
	if not route.is_empty():
		var points=PackedVector2Array([screen(player)])
		for p in route:points.append(screen(Vector2(p)))
		draw_polyline(points,Color(0.8,.72,.45,.45),1.5,true)
	_draw_heading("ВЕЛЬ", "Пограничный уезд · Последняя запись")

func _building(location: Dictionary) -> void:
	var p=screen(Vector2(float(location.pos[0]),float(location.pos[1])))
	var kind=location.kind
	if kind=="camp":
		for i in range(7):
			var a=i*TAU/7;draw_circle(p+Vector2(cos(a)*20,sin(a)*9)*zoom,5*zoom,Color("6c7164"))
		var pulse=1+sin(elapsed*4)*.07
		_poly([p+Vector2(-9,0)*zoom,p+Vector2(0,-38*pulse)*zoom,p+Vector2(12,1)*zoom],Color("d5a45c"))
		draw_circle(p-Vector2(0,10)*zoom,22*zoom,Color(0.8,.4,.16,.08))
		return
	if kind=="memorial":
		_poly([p+Vector2(-55,0)*zoom,p+Vector2(-55,-76)*zoom,p+Vector2(46,-101)*zoom,p+Vector2(46,-26)*zoom],Color("71786a"))
		for r in range(7):draw_line(p+Vector2(-43,-63+r*8)*zoom,p+Vector2(33,-84+r*8)*zoom,Color("333d38"),1.2,true)
		return
	if kind=="ruin":
		for ring in range(4):draw_arc(p-Vector2(0,ring*4)*zoom,43*zoom,0,TAU,36,Color("5c695e"),4*zoom,true)
		draw_circle(p,31*zoom,Color("101e20"));return
	var large=kind=="infirmary"
	var w=110.0 if large else 73.0
	var h=133.0 if large else 75.0
	var left=p+Vector2(-w,0)*zoom;var right=p+Vector2(w,0)*zoom
	var top=p+Vector2(0,-w*.48)*zoom;var front=p+Vector2(0,w*.48)*zoom
	var elevation=Vector2(0,-h)*zoom
	_poly([left,right,front+Vector2(14,12)*zoom,left+Vector2(-10,12)*zoom],Color(0,0,0,.2))
	_poly([left,front,front+elevation,left+elevation],Color("505d56"))
	_poly([front,right,right+elevation,front+elevation],Color("333f3d"))
	_poly([left+elevation,top+elevation-Vector2(0,30)*zoom,right+elevation,front+elevation],Color("71766a"))
	_poly([left+elevation,top+elevation-Vector2(0,30)*zoom,top+elevation-Vector2(0,43)*zoom,left+elevation-Vector2(0,13)*zoom],Color("333e3b"))
	for i in range(4):
		var a=left.lerp(front,(i+0.5)/4)-Vector2(0,h*.65)*zoom
		draw_line(a,a+Vector2(0,25)*zoom,Color("b0a175") if i==2 else Color("202c2a"),4*zoom,true)
	for i in range(6):
		var a=left.lerp(front,(i+0.3)/6)
		draw_line(a,a+elevation,Color(.14,.2,.17,.35),1,true)
	for i in range(6):
		var t=(i+1)/7.0
		draw_line((left+elevation).lerp(top+elevation-Vector2(0,30)*zoom,t),(front+elevation).lerp(right+elevation,t),Color(.2,.25,.21,.28),1,true)
	for r in range(6):draw_line(left+Vector2(0,-r*h/6)*zoom,front+Vector2(0,-r*h/6)*zoom,Color(.12,.17,.15,.35),1,true)
	var door=front+Vector2(17,-14)*zoom
	_poly([door,door+Vector2(0,-38)*zoom,door+Vector2(22,-49)*zoom,door+Vector2(22,-11)*zoom],Color("111b1a"))
	if kind=="archive":
		var banner=front+elevation+Vector2(13,4)*zoom
		_poly([banner,banner+Vector2(18,-8)*zoom,banner+Vector2(18,44)*zoom,banner+Vector2(9,38)*zoom,banner+Vector2(0,51)*zoom],Color("753e3e"))
		draw_line(banner+Vector2(8,3)*zoom,banner+Vector2(8,29)*zoom,Color("c1a67a"),2*zoom,true)
	if kind=="gate":
		for side in [-1,1]:
			var a=p+Vector2(side*65,-20)*zoom
			draw_line(a,a-Vector2(0,120)*zoom,Color("6e786b"),24*zoom,true)
		for i in range(7):draw_line(p+Vector2(-40+i*13,2)*zoom,p+Vector2(-40+i*13,-100)*zoom,Color("222c29"),3*zoom,true)
	elif kind=="chapel":
		draw_line(top+elevation,top+elevation-Vector2(0,50)*zoom,Color("929781"),9*zoom,true)
		draw_arc(top+elevation-Vector2(0,40)*zoom,18*zoom,0,TAU,28,Color("a69b7a"),2*zoom,true)
	elif large:
		var center=p+Vector2(0,-h*.8)*zoom
		for i in range(7):
			var end=p+Vector2(-90+i*30,20-absf(i-3)*7)*zoom
			var elbow=center.lerp(end,.6)+Vector2(sin(i)*16,-8)*zoom
			draw_polyline(PackedVector2Array([center,elbow,end]),Color("773f42"),7*zoom,true)
			draw_polyline(PackedVector2Array([center,elbow,end]),Color("ab7665"),1.5*zoom,true)
		draw_circle(center,27*zoom,Color("503339"))
		draw_arc(center,23*zoom,.2,TAU-.2,40,Color("a58b75"),4*zoom,true)
		draw_line(center-Vector2(0,15)*zoom,center+Vector2(0,15)*zoom,Color("181e1d"),4*zoom,true)

func _tree(p: Vector2) -> void:
	draw_circle(p,15*zoom,Color(0,0,0,.15))
	draw_line(p,p-Vector2(0,75)*zoom,Color("4c4a3b"),8*zoom,true)
	for i in range(4):
		var c=p+Vector2(sin(i*2)*22,-63-i*13)*zoom
		draw_circle(c,(30-i*3)*zoom,Color("263e33"))
		draw_arc(c,(25-i*3)*zoom,3.5,5.8,16,Color("50634b"),5*zoom,true)

func _actor(actor: Dictionary,p: Vector2,selected: bool,moving: bool=false) -> void:
	var dead=actor.hp<=0
	var level=int(actor.get("mutation",0))
	var ally=actor.team=="ally"
	draw_set_transform(p,0,Vector2(1,.42))
	draw_circle(Vector2.ZERO,(24+level*5)*zoom,Color(0,0,0,.35))
	if selected:draw_arc(Vector2.ZERO,30*zoom,0,TAU,48,Color("ddc08a"),2,true)
	draw_set_transform(Vector2.ZERO)
	var key=str(actor.get("art","hero"))
	if key in ["guard","archer"]:key="mira" if key=="guard" else "sava"
	if level>0:
		for side in [-1,1]:
			var elbow=p+Vector2(side*(30+level*8),-45-level*7)*zoom
			var tip=p+Vector2(side*(43+level*11),-8-level*10+sin(elapsed*2+side)*5)*zoom
			draw_polyline(PackedVector2Array([p-Vector2(0,55)*zoom,elbow,tip]),Color("9b766d"),float(5+level*2)*zoom,true)
			draw_line(elbow,tip,Color("d0bc9a"),1.5*zoom,true)
	var texture:Texture2D=textures.get(key,textures.hero)
	var frame=int(elapsed*8)%6 if moving else 0
	var region=Rect2(frame*128,0,128,112)
	var tint=Color("dad4ba") if ally else Color("b4ac98")
	if level>0:tint=Color("dbc0ba")
	if dead:tint=Color(.35,.31,.3,.8)
	if float(flashes.get(actor.id,0))>0:tint=Color("ffd6ab")
	var scale_factor=(.9+level*.13)*zoom
	var rect=Rect2(p+Vector2(-64,-94)*scale_factor,Vector2(128,112)*scale_factor)
	draw_texture_rect_region(texture,rect,region,tint)
	if dead:
		draw_line(p+Vector2(-15,-10)*zoom,p+Vector2(15,4)*zoom,Color("954d4e"),3*zoom,true)
		return
	if battle!=null:
		var bar=p+Vector2(-25,-92-level*8)*zoom
		draw_rect(Rect2(bar,Vector2(50,5)*zoom),Color("1a2320"))
		draw_rect(Rect2(bar,Vector2(50*float(actor.hp)/actor.max_hp,5)*zoom),Color("a5b586") if ally else Color("b06b5d"))
		draw_string(font,bar-Vector2(8,6),actor.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12,Color("dfd9c4"))

func _draw_battle() -> void:
	for sum_value in range(int(battle.encounter.width)+int(battle.encounter.height)):
		for x in range(int(battle.encounter.width)):
			var y=sum_value-x
			if y<0 or y>=int(battle.encounter.height):continue
			var tile=Vector2i(x,y)
			_tile(Vector2(tile),true,x*31+y*17)
			if battle.is_blocked(tile):
				var p=screen(Vector2(tile))
				_poly([p+Vector2(-28,0)*zoom,p+Vector2(0,14)*zoom,p+Vector2(28,0)*zoom,p+Vector2(28,-38)*zoom,p+Vector2(0,-24)*zoom,p+Vector2(-28,-38)*zoom],Color("535f57"))
				_poly([p+Vector2(-28,-38)*zoom,p+Vector2(0,-52)*zoom,p+Vector2(28,-38)*zoom,p+Vector2(0,-24)*zoom],Color("818472"))
	var active=battle.active_unit()
	if not active.is_empty() and active.hp>0 and battle.status=="playing":
		for y in range(int(battle.encounter.height)):
			for x in range(int(battle.encounter.width)):
				var tile=Vector2i(x,y)
				if battle.is_blocked(tile) or battle.occupied(tile,active.id):continue
				if reachable.has(tile) and mode=="move" and active.ap>0:
					var p=screen(Vector2(tile))
					draw_circle(p,2*zoom,Color(.7,.77,.62,.35))
	for objective in battle.encounter.objectives:
		var pos=objective.pos
		if objective.id=="prisoner":pos=battle.unit("prisoner").pos
		var p=screen(Vector2(float(pos[0]),float(pos[1])))
		var done=bool(battle.progress.get(objective.id,false))
		draw_arc(p,25*zoom,0,TAU,40,Color("63755a") if done else Color("d0ac69"),2,true)
		if objective.id.begins_with("seal_"):
			for i in range(6):
				var a=i*TAU/6
				draw_line(p,p+Vector2(cos(a)*24,sin(a)*12)*zoom,Color("b07967") if not done else Color("4c5c4b"),1,true)
			draw_line(p,p-Vector2(0,28)*zoom,Color("b07967"),3*zoom,true)
		draw_string(font,p+Vector2(-35,34),objective.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12,Color("d9c28f"))
	var sorted=battle.units.duplicate()
	sorted.sort_custom(func(a,b):return a.pos[0]+a.pos[1]<b.pos[0]+b.pos[1])
	for actor in sorted:
		var p:Vector2=drawn_units.get(actor.id,Vector2(float(actor.pos[0]),float(actor.pos[1])))
		_actor(actor,screen(p),actor.id==battle.active_id,p.distance_to(Vector2(float(actor.pos[0]),float(actor.pos[1])))>.05)
	if battle.in_bounds(hover):
		var p=screen(Vector2(hover))
		var color=Color("bf8064") if mode in ["attack","skill"] else Color("d4c495")
		draw_polyline(PackedVector2Array([p+Vector2(0,-16)*zoom,p+Vector2(32,0)*zoom,p+Vector2(0,16)*zoom,p+Vector2(-32,0)*zoom,p+Vector2(0,-16)*zoom]),color,1.8,true)
	_draw_heading(battle.encounter.title.to_upper(),"Раунд %d / %d · %s" % [battle.round_number,battle.encounter.round_limit,"Ваш ход" if battle.status=="playing" else "Столкновение завершено"])

func _draw_heading(title: String,subtitle: String) -> void:
	draw_rect(Rect2(0,0,size.x,79),Color(.035,.05,.045,.8))
	draw_string(title_font,Vector2(25,35),title,HORIZONTAL_ALIGNMENT_LEFT,-1,23,Color("ddd2b4"))
	draw_string(font,Vector2(26,60),subtitle,HORIZONTAL_ALIGNMENT_LEFT,-1,13,Color("929d88"))

func _draw_corners() -> void:
	for pos in [Vector2.ZERO,Vector2(size.x,0),size,Vector2(0,size.y)]:
		var direction=Vector2(1 if pos.x==0 else -1,1 if pos.y==0 else -1)
		draw_line(pos+Vector2(8,8)*direction,pos+Vector2(28,8)*direction,Color("6f7053"),1,true)
		draw_line(pos+Vector2(8,8)*direction,pos+Vector2(8,28)*direction,Color("6f7053"),1,true)

func _draw_minimap() -> void:
	if battle!=null:return
	var origin=Vector2(size.x-172,92)
	draw_rect(Rect2(origin,Vector2(154,112)),Color(.035,.06,.05,.9))
	draw_rect(Rect2(origin,Vector2(154,112)),Color("525e4c"),false,1)
	for location in Data.locations():
		var pos=Vector2(float(location.pos[0])*4.5,float(location.pos[1])*3.6)
		draw_circle(origin+Vector2(9,10)+pos,2.5,Color("b8a274"))
	draw_circle(origin+Vector2(9,10)+player*Vector2(4.5,3.6),3.5,Color("e2d5a7"))
