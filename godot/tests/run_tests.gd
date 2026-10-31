extends SceneTree

var checks := 0
var failures: Array[String] = []

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("FAIL: ", message)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var paths := ["res://scripts/model/tactical_battle.gd", "res://scripts/model/campaign.gd", "res://scripts/model/episode_data.gd"]
	for path in paths:
		check(FileAccess.file_exists(path), "Required gameplay model exists: " + path)
	if not failures.is_empty():
		finish()
		return
	var Battle = load(paths[0])
	var Campaign = load(paths[1])
	var Data = load(paths[2])
	var state = Campaign.new()
	check(state.party.size() == 3, "Three party members")
	check(state.party[0].cursed and not state.party[1].cursed and state.party[2].cursed, "Cursed and uncursed companions")
	var battle = state.start_battle("gate")
	check(battle.active_unit().team == "ally", "Player opens encounter")
	var hero: Dictionary = battle.unit("hero")
	var pos: Array = hero.pos.duplicate()
	check(not battle.move_unit("hero", Vector2i(-1, -1)), "Reject off-map movement")
	check(hero.ap == 2 and hero.pos == pos, "Rejected action preserves AP and position")
	check(not battle.attack("hero", "archer"), "Reject distant melee attack")
	check(hero.ap == 2, "Invalid attack does not spend AP")
	check(not battle.move_unit("hero", Vector2i(5, 5)), "Reject obstacle tile")
	check(battle.move_unit("hero", Vector2i(3, 6)), "Reach legal ground")
	check(hero.ap == 1, "Movement spends one AP")
	check(battle.transform("hero"), "Cursed hero can transform")
	check(hero.mutation == 1 and hero.ap == 0, "Transformation consumes action")
	check(not battle.transform("mira"), "Uncursed fighter cannot transform")
	check(not battle.revert("hero"), "Cannot revert inside battle")
	battle.end_activation()
	check(battle.activation_count >= 2, "Enemy acts between allied activations")
	check(battle.active_unit().team == "ally", "Control returns to next ally")
	check(battle.active_unit().id != "hero", "Party activates individually")
	check(Battle.compatibility(0) > Battle.compatibility(1) and Battle.compatibility(1) > Battle.compatibility(2), "Transformation reduces compatibility")
	check(Battle.support_amount(20, 0, 2) < Battle.support_amount(20, 0, 0), "Recipient transformation reduces healing")
	check(Battle.support_amount(20, 2, 0) < Battle.support_amount(20, 0, 0), "Source transformation reduces support")
	var snap: Dictionary = battle.to_dict()
	var restored = Battle.new(Data.encounter("gate"), state.party)
	check(restored.restore(snap), "Battle snapshot restores")
	check(restored.to_dict() == snap, "Battle snapshot retains activation/AP/objective")
	check(not restored.restore({"status": "playing"}), "Reject incomplete battle snapshot")
	check(restored.to_dict() == snap, "Rejected snapshot is non-destructive")
	# A ritual can be interrupted with living enemies.
	var ritual_state=Campaign.new()
	var ritual = ritual_state.start_battle("ritual")
	ritual.unit("hero").pos = [4, 4]
	check(ritual.interact("hero", "seal_a"), "Interact with adjacent ritual seal")
	ritual.unit("hero").pos = [8, 4]
	check(ritual.interact("hero", "seal_b"), "Interrupt second seal")
	check(ritual.status == "victory", "Objective ends encounter without full clear")
	check(ritual.alive_enemies().size() > 0, "Objective victory leaves living enemies")
	ritual_state.finish_battle(ritual)
	check(ritual_state.party[0].mutation == 0, "Transformation clears after combat")
	check(ritual_state.flags.get("ritual_stopped", false), "Victory updates campaign objective")
	var combo=Battle.new(Data.encounter("gate"),state.party)
	combo.active_id="mira"
	combo.unit("mira").pos=[6,7]
	combo.unit("hero").pos=[4,5]
	combo.unit("hero").mutation=2
	combo.unit("spear").pos=[6,5]
	var foe_hp=combo.unit("spear").hp
	check(combo.use_skill("mira","spear"),"Mira has a clear direct shot")
	check(combo.unit("spear").hp==foe_hp-8,"Supporting ally cannot strike through masonry")
	var no_fight=Campaign.new()
	var rogue=Battle.new(Data.encounter("gate"),no_fight.party)
	rogue.status="victory"
	check(not no_fight.finish_battle(rogue),"Only active campaign encounter can grant rewards")
	# All four dead personalities have distinct, usable borrowed skills.
	for voice in ["investigator","executioner","judge","bandit"]:
		var duel=Battle.new(Data.encounter("gate"),state.party)
		duel.unit("hero").pos=[6,6]
		duel.unit("spear").pos=[7,6]
		var has_voice=duel.get_property_list().any(func(prop):return prop.name=="selected_voice")
		check(has_voice,"Four-voice skill selection exists")
		if not has_voice:continue
		duel.selected_voice=voice
		check(duel.use_skill("hero","spear"),"Borrowed skill works: "+voice)
		check(duel.borrowed.get(voice,0)>0,"Borrowed skill strengthens correct voice: "+voice)
		if voice=="investigator":check(duel.unit("spear").get("exposed",0)>0,"Investigator reveals vulnerability")
		if voice=="judge":check(duel.unit("spear").get("bound",0)>0,"Judge disrupts enemy activation")
		if voice=="bandit":check(duel.unit("spear").get("bleeding",0)>0,"Bandit applies bleeding")
		if voice=="executioner":check(duel.unit("spear").hp<duel.unit("spear").max_hp,"Executioner lands heavy blow")
	# Conversations and automatic intervention.
	var campaign = Campaign.new()
	var before_coins: int = campaign.coins
	check(campaign.choose("gate", "pay").ok, "Payment obtains gate access")
	check(campaign.flags.get("gate_pass", false) and campaign.coins == before_coins - 3, "Payment applies once")
	check(not campaign.choose("gate", "pay").ok and campaign.coins == before_coins - 3, "Cannot duplicate consumed dialogue choice")
	var poor = Campaign.new()
	poor.coins = 0
	check(not poor.choose("gate", "pay").ok, "Cannot buy pass without funds")
	check(not poor.flags.get("gate_pass", false), "Rejected payment preserves quest")
	campaign.pressure["investigator"] = 60
	var trust_before: int = campaign.trust
	var line: Dictionary = campaign.talk("archivist")
	check(line.get("takeover", false), "Voice actually takes over conversation")
	check(campaign.trust < trust_before, "Takeover changes companion trust immediately")
	campaign.talk("archivist")
	check(campaign.trust == trust_before - 1, "Reopening takeover does not duplicate consequences")
	check(campaign.choose("archivist", "regain").ok, "Return control after takeover")
	check(not campaign.talk("archivist").get("takeover", false), "Takeover happens once per trigger")
	var saved: Dictionary = campaign.to_dict()
	var loaded = Campaign.new()
	check(loaded.restore(saved), "Campaign save restores")
	check(loaded.to_dict() == saved, "Save retains evidence/voices/relationships/resources")
	check(not loaded.restore({"version": 999}), "Reject unsupported save")
	check(loaded.to_dict() == saved, "Failed load preserves current game")
	# All three endings and a retry path.
	for route in ["rescue", "ritual", "bargain"]:
		var run_state = Campaign.new()
		run_state.flags["archive_read"] = true
		run_state.flags["gate_pass"] = true
		run_state.evidence = ["witness", "ledger", "registry"]
		var choice: Dictionary = run_state.choose("infirmary", route)
		check(choice.ok, "Resolution available: " + route)
		if route != "bargain":
			var fight = run_state.start_battle(choice.encounter)
			fight.status = "victory"
			run_state.finish_battle(fight)
		check(run_state.ending == route, "Resolution persists: " + route)
	var failed_run = Campaign.new()
	var lost = failed_run.start_battle("gate")
	lost.status = "defeat"
	failed_run.finish_battle(lost)
	check(failed_run.ending.is_empty(), "Defeat does not end campaign permanently")
	check(failed_run.start_battle("gate").status == "playing", "Defeat allows retry")
	finish()

func finish() -> void:
	print("MODEL TESTS: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
