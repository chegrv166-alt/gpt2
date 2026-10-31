extends RefCounted
const Data=preload("res://scripts/model/episode_data.gd")
const SIZE=Vector2i(512,384)
const SECTOR=32
static var _data: Dictionary={}
static var _walk=PackedByteArray()
static var _roads=PackedByteArray()
static var _water=PackedByteArray()
static var _solids: Array[Vector2i]=[]
static var _chunks: Dictionary={}
static var _terrain: Texture2D
var data: Dictionary

func _init() -> void:
	if _data.is_empty():_data=JSON.parse_string(FileAccess.get_file_as_string("res://content/region.json"))
	data=_data
	if _walk.is_empty():_prepare()

func bounds() -> Rect2i:return Rect2i(Vector2i.ZERO,SIZE)
func start() -> Vector2i:return Vector2i(data.start[0],data.start[1])
func river_x(y: int) -> int:return roundi(232+14*sin(float(y)*.025))
func entrance(id: String) -> Vector2i:
	for place in Data.locations():
		if place.id==id:return Vector2i(place.pos[0],place.pos[1]+2)
	return start()
func camps() -> Array:return Data.locations().filter(func(p):return p.get("category","")=="camp")
func district_at(point: Vector2) -> Dictionary:
	for district in data.districts:
		var r=district.rect
		if Rect2(r[0],r[1],r[2],r[3]).has_point(point):return district
	return {"id":"wilds","name":"Дороги Вельского уезда","color":"7d8994"}
func blocked(point: Vector2i) -> bool:
	return not bounds().has_point(point) or _walk[point.y*SIZE.x+point.x]==0
func road_strength(point: Vector2i) -> float:
	return float(_roads[point.y*SIZE.x+point.x])/255.0 if bounds().has_point(point) else 0.0
func navigation() -> AStarGrid2D:
	var nav=AStarGrid2D.new();nav.region=bounds();nav.cell_size=Vector2.ONE
	nav.diagonal_mode=AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	nav.default_compute_heuristic=AStarGrid2D.HEURISTIC_OCTILE;nav.default_estimate_heuristic=AStarGrid2D.HEURISTIC_OCTILE
	nav.update()
	for point in _solids:
		if blocked(point):nav.set_point_solid(point)
	return nav
func _block(point: Vector2i) -> void:
	if bounds().has_point(point) and _walk[point.y*SIZE.x+point.x]!=0:
		_walk[point.y*SIZE.x+point.x]=0;_solids.append(point)
func _footprint(point: Vector2i,radius: int) -> void:
	for y in range(point.y-radius,point.y+radius+1):
		for x in range(point.x-radius,point.x+radius+1):_block(Vector2i(x,y))
func _prepare() -> void:
	_walk.resize(SIZE.x*SIZE.y);_walk.fill(1)
	_roads.resize(_walk.size());_roads.fill(0);_water.resize(_walk.size());_water.fill(0)
	for y in range(SIZE.y):
		var center=river_x(y)
		for x in range(center-8,center+9):
			_block(Vector2i(x,y));_water[y*SIZE.x+x]=255
		_block(Vector2i(0,y));_block(Vector2i(SIZE.x-1,y))
	for x in range(SIZE.x):_block(Vector2i(x,0));_block(Vector2i(x,SIZE.y-1))
	var brush: Array=[]
	for y in range(-3,4):
		for x in range(-3,4):
			var length=Vector2(x,y).length()
			if length<=3.5:brush.append([Vector2i(x,y),int(clampf(3.5-length,0,1)*255)])
	for road in data.roads:
		for i in range(road.size()-1):
			var a=Vector2(road[i][0],road[i][1]);var b=Vector2(road[i+1][0],road[i+1][1])
			var steps=maxi(1,int(maxf(absf(a.x-b.x),absf(a.y-b.y))))
			for step in range(steps+1):
				var p=Vector2i(a.lerp(b,float(step)/steps).round())
				for bit in brush:
					var q:Vector2i=p+bit[0]
					if bounds().has_point(q):
						var idx=q.y*SIZE.x+q.x;_roads[idx]=maxi(_roads[idx],bit[1])
	for bridge in data.bridges:
		for y in range(bridge.y-3,bridge.y+4):
			for x in range(river_x(y)-12,river_x(y)+13):
				var idx=y*SIZE.x+x;_walk[idx]=1;_roads[idx]=255;_water[idx]=0
	for place in Data.locations():
		if place.kind in ["house","archive","chapel","infirmary","gate","market","memorial"]:_footprint(Vector2i(place.pos[0],place.pos[1]),1)
	for item in data.scenery:
		var p=Vector2i(item.point[0],item.point[1])
		if blocked(p):continue
		if item.get("solid",false):_footprint(p,1 if item.key in ["house","house_b","inn","warehouse"] else 0)
		var sector=Vector2i(p.x/SECTOR,p.y/SECTOR)
		if not _chunks.has(sector):_chunks[sector]=[]
		_chunks[sector].append(item)
	# Keep authored approaches clear even when a decorative root nearly touches one.
	for place in Data.locations():
		var p=entrance(place.id)
		if bounds().has_point(p) and _water[p.y*SIZE.x+p.x]==0:_walk[p.y*SIZE.x+p.x]=1

func scenery_near(area: Rect2) -> Array:
	var result: Array=[]
	var begin=Vector2i((area.position/SECTOR).floor());var end=Vector2i((area.end/SECTOR).ceil())
	for y in range(begin.y,end.y+1):
		for x in range(begin.x,end.x+1):result.append_array(_chunks.get(Vector2i(x,y),[]))
	return result

func terrain_texture() -> Texture2D:
	if _terrain!=null:return _terrain
	var bytes=PackedByteArray();bytes.resize(SIZE.x*SIZE.y*4)
	for y in range(SIZE.y):
		for x in range(SIZE.x):
			var idx=y*SIZE.x+x;var dst=idx*4
			bytes[dst]=_roads[idx];bytes[dst+1]=_water[idx];bytes[dst+2]=0;bytes[dst+3]=255
	for district in data.districts:
		var r=district.rect;var index=["town","docks","graves","forest","abbey"].find(district.id)
		for y in range(r[1],r[1]+r[3]):
			for x in range(r[0],r[0]+r[2]):bytes[(y*SIZE.x+x)*4+2]=40+index*45
	_terrain=ImageTexture.create_from_image(Image.create_from_data(SIZE.x,SIZE.y,false,Image.FORMAT_RGBA8,bytes))
	return _terrain
