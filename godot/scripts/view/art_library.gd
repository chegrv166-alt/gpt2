extends RefCounted
## Immutable source atlases. Their transparent content is cropped as a resource,
## never rewritten; the same ground anchor drives drawing and input geometry.

const SHEETS={
	"landmarks":["house","archive","chapel","infirmary","gate","ruin"],
	"props":["memorial","market","camp","tree","cover","tree_pale"],
	"characters":["hero","mira","sava","guard","archer","prisoner"],
	"mutations":["hero_1","hero_2","sava_1","sava_2"],
	"portraits":["portrait_hero","portrait_mira","portrait_sava","portrait_investigator","portrait_executioner","portrait_judge"],
	"terrain":["cobble","earth","flagstone","water"]
}
const HEIGHTS={
	"house":224.0,"archive":300.0,"chapel":325.0,"infirmary":345.0,"gate":220.0,"ruin":115.0,
	"memorial":133.0,"market":169.0,"camp":62.0,"tree":262.0,"tree_pale":245.0,"cover":62.0,
	"hero":100.0,"mira":100.0,"sava":100.0,"guard":108.0,"archer":100.0,"prisoner":94.0,
	"hero_1":118.0,"hero_2":150.0,"sava_1":120.0,"sava_2":152.0
}
static var _textures: Dictionary={}
const SOURCE_REGIONS={
	"house":Rect2i(0,0,512,502),"archive":Rect2i(512,0,512,548),"chapel":Rect2i(1024,0,512,568),
	"infirmary":Rect2i(0,502,512,522),"gate":Rect2i(512,548,512,476),"ruin":Rect2i(1024,568,512,456)
}

func _init() -> void:
	if not _textures.is_empty():return
	for sheet in SHEETS:
		var source=load("res://assets/painted/%s.png"%sheet) as Texture2D
		if source==null:continue
		var columns=2 if sheet in ["mutations","terrain"] else 3
		var image=source.get_image()
		var cell=Vector2i(image.get_width()/columns,image.get_height()/2)
		for i in range(SHEETS[sheet].size()):
			var key=SHEETS[sheet][i]
			var region=Rect2i(Vector2i(i%columns,i/columns)*cell,cell)
			if SOURCE_REGIONS.has(key):region=SOURCE_REGIONS[key]
			if sheet not in ["portraits","terrain"]:
				var used=image.get_region(region).get_used_rect()
				if used.has_area():
					# Keep a small clear edge to prevent atlas filtering into a neighbour.
					used=used.grow(3).intersection(Rect2i(Vector2i.ZERO,cell))
					region=Rect2i(region.position+used.position,used.size)
			var atlas=AtlasTexture.new();atlas.atlas=source;atlas.region=Rect2(region);atlas.filter_clip=true
			_textures[key]=atlas

func texture(key: String) -> Texture2D:
	return _textures.get(key)

func rect(key: String,foot: Vector2,scale: float=1.0) -> Rect2:
	var tex=texture(key)
	if tex==null:return Rect2(foot,Vector2.ZERO)
	var height=float(HEIGHTS.get(key,100.0))*scale
	var width=height*tex.get_width()/tex.get_height()
	var anchor=.94 if key in ["hero","mira","sava","guard","archer","prisoner","hero_1","hero_2","sava_1","sava_2"] else .86
	return Rect2(foot-Vector2(width*.5,height*anchor),Vector2(width,height))

func actor_key(actor: Dictionary) -> String:
	var key=str(actor.get("art",actor.get("id","hero")))
	var mutation=clampi(int(actor.get("mutation",0)),0,2)
	if key in ["hero","sava"] and mutation>0:return key+"_"+str(mutation)
	return key if _textures.has(key) else "prisoner"

func portrait(key: String) -> Texture2D:
	return texture("portrait_"+key)
