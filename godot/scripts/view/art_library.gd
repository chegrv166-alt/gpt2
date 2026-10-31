extends RefCounted
## Immutable source atlases. Their transparent content is cropped as a resource,
## never rewritten; the same ground anchor drives drawing and input geometry.

const SHEETS={
	"landmarks":["house","archive","chapel","infirmary","gate","ruin"],
	"props":["memorial","market","camp","tree","cover","tree_pale"],
	"characters":["hero","mira","sava","guard","archer","prisoner"],
	"mutations":["hero_1","hero_2","sava_1","sava_2"],
	"portraits":["portrait_hero","portrait_mira","portrait_sava","portrait_investigator","portrait_executioner","portrait_judge"],
	"dialogue_portraits":["portrait_bandit","portrait_witness","portrait_archivist","portrait_market","portrait_guard","portrait_warden"],
	"terrain":["cobble","earth","flagstone","water"]
	,"region_scenery":["house_b","warehouse","inn","bridge","grave","pine"]
	,"region_bridge":["bridge_full"]
	,"region_harbor":["pier","boat","ferry","yard_fence","cart","barrels"]
}
const HEIGHTS={
	"house":300.0,"archive":390.0,"chapel":430.0,"infirmary":470.0,"gate":270.0,"ruin":140.0,
	"memorial":160.0,"market":185.0,"camp":65.0,"tree":262.0,"tree_pale":245.0,"cover":62.0,
	"hero":108.0,"mira":108.0,"sava":110.0,"guard":114.0,"archer":104.0,"prisoner":98.0,
	"hero_1":118.0,"hero_2":150.0,"sava_1":120.0,"sava_2":152.0
	,"house_b":300.0,"warehouse":255.0,"inn":290.0,"bridge":285.0,"grave":95.0,"pine":300.0
	,"bridge_full":512.0
	,"pier":410.0,"boat":105.0,"ferry":175.0,"yard_fence":100.0,"cart":110.0,"barrels":70.0
}
static var _textures: Dictionary={}
static var _images: Dictionary={}
const SOURCE_REGIONS={
	"house":Rect2i(0,0,512,502),"archive":Rect2i(512,0,512,548),"chapel":Rect2i(1024,0,512,568),
	"infirmary":Rect2i(0,502,512,522),"gate":Rect2i(512,548,512,476),"ruin":Rect2i(1024,568,512,456)
	,"bridge":Rect2i(0,512,640,512),"grave":Rect2i(550,512,590,512),"pine":Rect2i(1140,512,396,512)
}
# Inspected physical silhouettes, excluding the generator's distant soft halo.
# These are resource coordinates only; source PNG bytes remain unchanged.
const SILHOUETTES={
	"house":Rect2i(148,60,280,442),"archive":Rect2i(579,17,428,523),"chapel":Rect2i(1107,8,328,560),
	"infirmary":Rect2i(49,502,463,495),"gate":Rect2i(512,570,495,412),"ruin":Rect2i(1086,584,400,426),
	"hero":Rect2i(196,30,299,482),"mira":Rect2i(634,30,313,476),"sava":Rect2i(1079,26,296,477),
	"guard":Rect2i(213,512,253,466),"archer":Rect2i(689,521,217,455),"prisoner":Rect2i(1186,528,154,456),
	"memorial":Rect2i(16,14,496,498),"market":Rect2i(512,13,512,476),"camp":Rect2i(1024,235,496,277),
	"tree":Rect2i(47,512,465,497),"cover":Rect2i(512,516,512,490),"tree_pale":Rect2i(1024,512,446,495),
	"hero_1":Rect2i(165,30,366,580),"hero_2":Rect2i(708,17,469,610),
	"sava_1":Rect2i(125,632,416,574),"sava_2":Rect2i(711,627,458,606)
}

func _init() -> void:
	if not _textures.is_empty():return
	for sheet in SHEETS:
		var source=load("res://assets/painted/%s.png"%sheet) as Texture2D
		if source==null:continue
		var columns=1 if sheet=="region_bridge" else 2 if sheet in ["mutations","terrain"] else 3
		var rows=1 if sheet=="region_bridge" else 2
		var image=source.get_image()
		var cell=Vector2i(image.get_width()/columns,image.get_height()/rows)
		for i in range(SHEETS[sheet].size()):
			var key=SHEETS[sheet][i]
			var region=Rect2i(Vector2i(i%columns,i/columns)*cell,cell)
			if SOURCE_REGIONS.has(key):region=SOURCE_REGIONS[key]
			if SILHOUETTES.has(key):region=SILHOUETTES[key].grow(3).intersection(region)
			if sheet not in ["portraits","dialogue_portraits","terrain"]:
				var used=image.get_region(region).get_used_rect()
				if used.has_area():
					# Keep a small clear edge to prevent atlas filtering into a neighbour.
					used=used.grow(3).intersection(Rect2i(Vector2i.ZERO,region.size))
					region=Rect2i(region.position+used.position,used.size)
			var atlas=AtlasTexture.new();atlas.atlas=source;atlas.region=Rect2(region);atlas.filter_clip=true
			_textures[key]=atlas
			_images[key]=image.get_region(region)

func texture(key: String) -> Texture2D:
	return _textures.get(key)

func image(key: String) -> Image:
	return _images.get(key)

func hit(key: String,bounds: Rect2,point: Vector2) -> bool:
	if not bounds.grow(2).has_point(point) or not bounds.has_area():return false
	var pixels=image(key)
	if pixels==null:return false
	var local=(point-bounds.position)/bounds.size*Vector2(pixels.get_size())
	var pixel=Vector2i(clampi(int(local.x),0,pixels.get_width()-1),clampi(int(local.y),0,pixels.get_height()-1))
	return pixels.get_pixelv(pixel).a>.25

func rect(key: String,foot: Vector2,scale: float=1.0) -> Rect2:
	var tex=texture(key)
	if tex==null:return Rect2(foot,Vector2.ZERO)
	var height=float(HEIGHTS.get(key,100.0))*scale
	var width=height*tex.get_width()/tex.get_height()
	var anchor=.94 if key in ["hero","mira","sava","guard","archer","prisoner","hero_1","hero_2","sava_1","sava_2"] else .86
	if key=="bridge_full":anchor=.53
	if key=="pier":anchor=.6
	return Rect2(foot-Vector2(width*.5,height*anchor),Vector2(width,height))

func actor_key(actor: Dictionary) -> String:
	if actor.get("id","")=="prisoner":return "prisoner"
	var key=str(actor.get("art",actor.get("id","hero")))
	var mutation=clampi(int(actor.get("mutation",0)),0,2)
	if key in ["hero","sava"] and mutation>0:return key+"_"+str(mutation)
	return key if _textures.has(key) else "prisoner"

func portrait(key: String) -> Texture2D:
	return texture("portrait_"+key)
