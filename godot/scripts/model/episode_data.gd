extends RefCounted

static var _cache: Dictionary = {}

static func all() -> Dictionary:
	if _cache.is_empty():
		var parsed = JSON.parse_string(FileAccess.get_file_as_string("res://content/episode.json"))
		if parsed is Dictionary:
			_cache = parsed
	return _cache

static func encounter(id: String) -> Dictionary:
	return all().get("encounters", {}).get(id, {}).duplicate(true)

static func dialogue(id: String) -> Array:
	return all().get("dialogues", {}).get(id, []).duplicate(true)

static func locations() -> Array:
	return all().get("locations", []).duplicate(true)

static func initial_party() -> Array:
	return all().get("party", []).duplicate(true)
