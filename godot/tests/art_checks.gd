extends SceneTree

var checks=0
var failures: Array[String]=[]

func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures.append(message);print("FAIL: ",message)

func _initialize() -> void:call_deferred("run")

func run() -> void:
	var exists=ResourceLoader.exists("res://scripts/view/art_library.gd")
	check(exists,"Original painted art library is available")
	if not exists:finish();return
	var art=load("res://scripts/view/art_library.gd").new()
	for key in ["house","archive","chapel","infirmary","gate","ruin","memorial","market","camp","tree","tree_pale","cover","hero","mira","sava","guard","archer","prisoner","hero_1","hero_2","sava_1","sava_2","portrait_hero","portrait_mira","portrait_sava","cobble","earth","flagstone","water"]:
		var texture=art.texture(key)
		check(texture!=null and texture.get_width()>8 and texture.get_height()>8,"Runtime image exists: "+key)
		var foot=Vector2(400,300)
		var rect=art.rect(key,foot,0.8)
		check(rect.has_point(foot-Vector2(0,2)) and rect.size.x>0 and rect.size.y>0,"Ground anchor matches visible and clickable image: "+key)
	var forms: Array=[]
	for id in ["hero","sava"]:
		for level in range(3):forms.append(art.actor_key({"id":id,"art":id,"mutation":level}))
	var unique: Dictionary={}
	for key in forms:unique[key]=true
	check(forms.size()==6 and unique.size()==6,"Two cursed actors have six distinct human/transformed silhouettes")
	check(art.actor_key({"art":"guard","mutation":0})!="mira","Enemy guard does not reuse a companion image")
	check(art.actor_key({"art":"archer","mutation":0})!="sava","Enemy scout does not reuse a companion image")
	for key in ["hero","mira","sava","hero_2","sava_2","house","chapel","tree"]:
		var image=art.texture(key).get_image()
		check(image.get_pixel(0,0).a<0.1,"Sprite has actual transparent corners: "+key)
	finish()

func finish() -> void:
	print("ART TESTS: %d checks, %d failures"%[checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
