extends Control
signal destination_selected(point: Vector2i)
signal travel_selected(id: String)
const Layout=preload("res://scripts/model/world_layout.gd")
const Data=preload("res://scripts/model/episode_data.gd")
var layout=Layout.new()
var campaign=null
var notice=""
var font=preload("res://assets/body.ttf")
var title=preload("res://assets/title.ttf")
func _ready() -> void:
	mouse_default_cursor_shape=Control.CURSOR_CROSS;mouse_filter=Control.MOUSE_FILTER_STOP
func map_rect() -> Rect2:
	var scale=minf((size.x-32)/512.0,(size.y-42)/384.0)
	return Rect2((size-Vector2(512,384)*scale)*.5,Vector2(512,384)*scale)
func project(point: Vector2) -> Vector2:
	var rect=map_rect();return rect.position+point/Vector2(512,384)*rect.size
func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT:
		var rect=map_rect()
		if rect.has_point(event.position):
			var p=(event.position-rect.position)/rect.size*Vector2(512,384)
			destination_selected.emit(Vector2i(p.round()))
		accept_event()
func _draw() -> void:
	if campaign==null:return
	var rect=map_rect()
	draw_rect(Rect2(Vector2.ZERO,size),Color("101820"));draw_rect(rect,Color("202c31"))
	for district in layout.data.districts:
		var r=district.rect;var a=project(Vector2(r[0],r[1]));var b=project(Vector2(r[0]+r[2],r[1]+r[3]))
		var color=Color(district.color)
		draw_rect(Rect2(a,b-a),Color(color,.09));draw_rect(Rect2(a,b-a),Color(color,.19),false,1)
	var river=PackedVector2Array()
	for cliff in layout.data.get("cliffs",[]):
		var r=cliff.rect;var a=project(Vector2(r[0],r[1]));var b=project(Vector2(r[0]+r[2],r[1]+r[3]))
		draw_rect(Rect2(a,b-a),Color("354348"));draw_rect(Rect2(a,b-a),Color("78817b"),false,1)
	for sector in campaign.visited:
		var a=project(Vector2(int(sector)%16*32,int(sector)/16*32))
		draw_rect(Rect2(a,rect.size*Vector2(32.0/512,32.0/384)),Color(.65,.65,.52,.08))
	for y in range(0,384,3):river.append(project(Vector2(layout.river_x(y),y)))
	draw_polyline(river,Color("425e6a"),rect.size.x/512*17,true)
	for road in layout.data.roads:
		var points=PackedVector2Array()
		for p in road:points.append(project(Vector2(p[0],p[1])))
		draw_polyline(points,Color(.67,.6,.45,.72),1.4,true)
	for bridge in layout.data.bridges:
		var x=layout.river_x(bridge.y)
		draw_line(project(Vector2(x-12,bridge.y)),project(Vector2(x+12,bridge.y)),Color("ccb68e"),4,true)
	for place in Data.locations():
		if not campaign.discovered.has(place.id):continue
		var p=project(Vector2(place.pos[0],place.pos[1]))
		var camp=place.get("category","")=="camp"
		draw_circle(p,4.5 if camp else 2.5,Color("e1bd7e") if camp else Color("b5b7af"))
	for district in layout.data.districts:
		var p=project(Vector2(district.center[0],district.center[1]))
		var width=title.get_string_size(district.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12).x
		draw_string_outline(title,p+Vector2(-width*.5,-22),district.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12,3,Color("101820"))
		draw_string(title,p+Vector2(-width*.5,-22),district.name,HORIZONTAL_ALIGNMENT_LEFT,-1,12,Color("d2c4a8"))
	var player=project(Vector2(campaign.world_position[0],campaign.world_position[1]))
	draw_arc(player,8,0,TAU,24,Color("f2e0b6"),1.4,true);draw_circle(player,3,Color("fff0c9"))
	draw_rect(rect,Color("73644e"),false,1)
	draw_string(font,Vector2(12,size.y-8),"● Отряд     ● Открытый лагерь     ЛКМ — проложить путь",HORIZONTAL_ALIGNMENT_LEFT,-1,11,Color("b5b7ae"))
	if not notice.is_empty():draw_string(font,Vector2(12,16),notice,HORIZONTAL_ALIGNMENT_LEFT,size.x-24,11,Color("dfa78e"))
