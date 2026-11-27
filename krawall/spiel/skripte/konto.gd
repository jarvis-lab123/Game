## Spielstand: Münzen, freigeschaltete Charaktere (mit Stufe), Box-Öffnungen.
## Gespeichert in user://spielstand.json (bleibt zwischen Spielstarts erhalten).
extends Node

const DATEI := "user://spielstand.json"

var muenzen := 0
var besitz := {}          # id -> {"stufe": int, "kopien": int}
var auswahl := {}         # id -> {"gadget": int, "passiv": int}
var pech_zaehler := 0     # Boxen ohne Charakter in Folge (für die Garantie)
var karte := "schulkomplex"   # gewählte Karte im Schulmodus
var gewaehlt := ""        # id des Charakters, mit dem man ins Match geht
var statistik := {"siege": 0, "niederlagen": 0, "unentschieden": 0, "kos": 0, "boxen": 0}

var seltenheiten: Array = []
var boxen: Array = []
var regeln: Dictionary = {}


func _ready() -> void:
	_tabellen_laden()
	laden()


func _tabellen_laden() -> void:
	var s = JSON.parse_string(FileAccess.get_file_as_string("res://daten/seltenheiten.json"))
	var b = JSON.parse_string(FileAccess.get_file_as_string("res://daten/boxen.json"))
	seltenheiten = s["seltenheiten"] if s else []
	regeln = b if b else {}
	regeln["max_stufe"] = s.get("max_stufe", 10) if s else 10
	boxen = regeln.get("boxen", [])


func seltenheit(id: String) -> Dictionary:
	for s in seltenheiten:
		if s["id"] == id:
			return s
	return seltenheiten[0] if seltenheiten.size() > 0 else {"id": id, "name": id, "farbe": "#FFFFFF"}


func seltenheit_rang(id: String) -> int:
	for i in seltenheiten.size():
		if seltenheiten[i]["id"] == id:
			return i
	return 0


# ---------------------------------------------------------------- Speichern
func laden() -> void:
	if FileAccess.file_exists(DATEI):
		var d = JSON.parse_string(FileAccess.get_file_as_string(DATEI))
		if typeof(d) == TYPE_DICTIONARY:
			muenzen = int(d.get("muenzen", 0))
			besitz = d.get("besitz", {})
			auswahl = d.get("auswahl", {})
			pech_zaehler = int(d.get("pech_zaehler", 0))
			gewaehlt = str(d.get("gewaehlt", ""))
			statistik.merge(d.get("statistik", {}), true)
			karte = str(d.get("karte", "schulkomplex"))
	Schule.karte_id = karte
	_startcharaktere()


func speichern() -> void:
	var f := FileAccess.open(DATEI, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"muenzen": muenzen, "besitz": besitz, "auswahl": auswahl,
			"pech_zaehler": pech_zaehler, "gewaehlt": gewaehlt, "statistik": statistik, "karte": karte}, "  "))


func zuruecksetzen() -> void:
	muenzen = 0
	besitz = {}
	auswahl = {}
	pech_zaehler = 0
	for k in statistik:
		statistik[k] = 0
	_startcharaktere(true)


## Startcharaktere: alle mit "start": true. Gibt es keinen, der erste gewöhnliche.
func _startcharaktere(neu := false) -> void:
	if besitz.size() > 0 and not neu:
		# Charaktere, die es nicht mehr gibt, entfernen; Start-Charaktere immer dazugeben
		for c in Daten.charaktere:
			if c.get("start", false) and not besitz.has(c["id"]):
				besitz[c["id"]] = {"stufe": 1, "kopien": 0}
		if besitzt_irgendeinen():
			return
	var erste: Array = Daten.charaktere.filter(func(c): return c.get("start", false))
	if erste.is_empty() and Daten.charaktere.size() > 0:
		var sortiert: Array = Daten.charaktere.duplicate()
		sortiert.sort_custom(func(a, b): return seltenheit_rang(a.get("seltenheit", "")) < seltenheit_rang(b.get("seltenheit", "")))
		erste = [sortiert[0]]
	for c in erste:
		besitz[c["id"]] = {"stufe": 1, "kopien": 0}
	if neu or muenzen == 0:
		muenzen = int(regeln.get("start_muenzen", 300))
	speichern()


## Der gewählte Charakter (immer einer, den man besitzt)
func gewaehlter_charakter() -> Dictionary:
	for c in Daten.charaktere:
		if c["id"] == gewaehlt and besitz.has(c["id"]):
			return c
	for c in Daten.charaktere:
		if besitz.has(c["id"]):
			gewaehlt = c["id"]
			return c
	return Daten.charaktere[0] if Daten.charaktere.size() > 0 else Daten.STANDARD


func besitzt_irgendeinen() -> bool:
	for c in Daten.charaktere:
		if besitz.has(c["id"]):
			return true
	return false


func besitzt(id: String) -> bool:
	return besitz.has(id)


func stufe(id: String) -> int:
	return int(besitz.get(id, {}).get("stufe", 1))


func gewaehlt_gadget(id: String) -> int:
	return int(auswahl.get(id, {}).get("gadget", 0))


func gewaehlt_passiv(id: String) -> int:
	return int(auswahl.get(id, {}).get("passiv", 0))


func waehlen(id: String, art: String, index: int) -> void:
	if not auswahl.has(id):
		auswahl[id] = {}
	auswahl[id][art] = index
	speichern()


# ---------------------------------------------------------------- Belohnungen
func match_belohnung(ergebnis: int, kos: int) -> int:
	var b: Dictionary = regeln.get("belohnung", {})
	var m := int(b.get("sieg", 60)) if ergebnis == 1 else (int(b.get("niederlage", 25)) if ergebnis == -1 else int(b.get("unentschieden", 40)))
	m += kos * int(b.get("pro_ko", 5))
	muenzen += m
	statistik["siege" if ergebnis == 1 else ("niederlagen" if ergebnis == -1 else "unentschieden")] += 1
	statistik["kos"] += kos
	speichern()
	return m


# ---------------------------------------------------------------- Boxen
func box(id: String) -> Dictionary:
	for b in boxen:
		if b["id"] == id:
			return b
	return {}


func kann_kaufen(id: String) -> bool:
	return muenzen >= int(box(id).get("preis", 999999))


## Öffnet eine Box. Ergebnis: {"muenzen": int, "charakter": id oder "", "neu": bool, "stufe": int,
##  "seltenheit": id, "duplikat_muenzen": int, "garantie": bool}
func box_oeffnen(id: String) -> Dictionary:
	var b := box(id)
	if b.is_empty() or muenzen < int(b["preis"]):
		return {}
	muenzen -= int(b["preis"])
	statistik["boxen"] += 1
	var bereich: Array = b.get("muenzen", [20, 50])
	var e := {"muenzen": randi_range(int(bereich[0]), int(bereich[1])), "charakter": "", "neu": false,
		"stufe": 0, "seltenheit": "", "duplikat_muenzen": 0, "garantie": false}
	var chancen: Dictionary = b.get("chancen", {})
	var garantie := pech_zaehler + 1 >= int(regeln.get("garantie_nach", 8))
	var gezogen := _seltenheit_wuerfeln(chancen, garantie)
	if gezogen != "":
		var c := _charakter_waehlen(gezogen)
		if not c.is_empty():
			e["charakter"] = c["id"]
			e["seltenheit"] = c.get("seltenheit", "gewoehnlich")
			e["garantie"] = garantie
			if not besitz.has(c["id"]):
				besitz[c["id"]] = {"stufe": 1, "kopien": 0}
				e["neu"] = true
				e["stufe"] = 1
			else:
				var eintrag: Dictionary = besitz[c["id"]]
				eintrag["kopien"] = int(eintrag.get("kopien", 0)) + 1
				if int(eintrag["stufe"]) < int(regeln["max_stufe"]):
					eintrag["stufe"] = int(eintrag["stufe"]) + 1
				else:
					e["duplikat_muenzen"] = int(seltenheit(e["seltenheit"]).get("duplikat_muenzen", 20))
				e["stufe"] = eintrag["stufe"]
	pech_zaehler = 0 if e["charakter"] != "" else pech_zaehler + 1
	muenzen += e["muenzen"] + e["duplikat_muenzen"]
	speichern()
	return e


func _seltenheit_wuerfeln(chancen: Dictionary, garantie: bool) -> String:
	var summe := 0.0
	for k in chancen:
		summe += float(chancen[k])
	var wurf := randf() * (summe if garantie else 100.0)
	# von selten nach häufig prüfen, damit Rundungen der seltenen Stufen nicht verloren gehen
	var reihenfolge := seltenheiten.duplicate()
	reihenfolge.reverse()
	for s in reihenfolge:
		var p := float(chancen.get(s["id"], 0.0))
		if wurf < p:
			return s["id"]
		wurf -= p
	return ""


## Zieht einen Charakter der Seltenheit; neue werden bevorzugt. Gibt es keinen dieser Seltenheit,
## wird die nächstniedrigere genommen.
func _charakter_waehlen(selt: String) -> Dictionary:
	var rang := seltenheit_rang(selt)
	while rang >= 0:
		var id: String = seltenheiten[rang]["id"]
		var pool: Array = Daten.charaktere.filter(func(c): return c.get("seltenheit", "gewoehnlich") == id)
		if pool.size() > 0:
			var neue := pool.filter(func(c): return not besitz.has(c["id"]))
			var aus := neue if neue.size() > 0 else pool
			return aus[randi() % aus.size()]
		rang -= 1
	return {}


## Wahrscheinlichkeiten einer Box als lesbarer Text (für den Shop)
func chancen_text(id: String) -> String:
	var b := box(id)
	var zeilen := []
	var summe := 0.0
	for s in seltenheiten:
		var p := float(b.get("chancen", {}).get(s["id"], 0.0))
		summe += p
		if p > 0.0:
			zeilen.append("%s: %s %%" % [s["name"], str(p)])
	zeilen.append("Nur Münzen: %s %%" % str(snappedf(maxf(0.0, 100.0 - summe), 0.1)))
	return "\n".join(zeilen)
