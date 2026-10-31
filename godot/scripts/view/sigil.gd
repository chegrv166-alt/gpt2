extends Control
## Small native ironwork emblem; no icon-font dependency.
var blood=false
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw() -> void:
	var p=size*.5;var r=minf(size.x,size.y)*.33
	var color=Color("a66b70") if blood else Color("a38d66")
	draw_arc(p,r,-PI*.8,PI*.8,48,Color(color,.65),1,true)
	draw_arc(p,r*.77,PI*.2,PI*1.8,48,Color(color,.4),1,true)
	draw_polyline(PackedVector2Array([p+Vector2(0,-r*1.2),p+Vector2(r*.45,0),p+Vector2(0,r*1.2),p-Vector2(r*.45,0),p+Vector2(0,-r*1.2)]),color,1,true)
	draw_line(p-Vector2(r*.9,0),p+Vector2(r*.9,0),Color(color,.6),1,true)
	draw_circle(p,2,color)
