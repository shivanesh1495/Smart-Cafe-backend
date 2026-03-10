"""Test the forecasting API predictions."""
import requests
import json

API = "http://localhost:5001"

# 1. Analytics
r = requests.get(f"{API}/analytics")
data = r.json()
print("=== MODEL METRICS ===")
print(json.dumps(data["metrics"], indent=2))
print(f"Total records: {data['total_records']}")
print(f"Avg demand:    {data['average_demand']}")
print("\nTop drivers:")
for d in data["top_drivers"]:
    print(f"  {d['factor']:25s}  {d['importance']:.4f}")

# 2. Chart data sample
print("\n=== CHART DATA (Actual vs Predicted, Test Set) ===")
for item in data.get("chart_data", [])[:10]:
    a = item["actual"]
    p = item["predicted"]
    err = abs(a - p) / max(a, 1) * 100
    print(f"  {item.get('day','?'):3s} {item.get('meal','?'):10s} {item.get('event','?'):20s}  Actual={a:4d}  Predicted={p:4d}  Err={err:.1f}%")

# 3. Scenario predictions
print("\n=== SCENARIO PREDICTIONS ===")
scenarios = [
    {"Day_of_Week": "MON", "Meal_Type": "Lunch",     "Is_Veg": True,  "Event_Context": "Normal",           "Weather": "Sunny"},
    {"Day_of_Week": "MON", "Meal_Type": "Lunch",     "Is_Veg": True,  "Event_Context": "End_Sem_Exams",    "Weather": "Sunny"},
    {"Day_of_Week": "SAT", "Meal_Type": "Lunch",     "Is_Veg": True,  "Event_Context": "Weekend",          "Weather": "Sunny"},
    {"Day_of_Week": "MON", "Meal_Type": "Lunch",     "Is_Veg": True,  "Event_Context": "Winter_Vacation",  "Weather": "Cold"},
    {"Day_of_Week": "WED", "Meal_Type": "Breakfast",  "Is_Veg": True,  "Event_Context": "Normal",           "Weather": "Heavy_Rain"},
    {"Day_of_Week": "FRI", "Meal_Type": "Dinner",    "Is_Veg": False, "Event_Context": "Normal",           "Weather": "Cold"},
    {"Day_of_Week": "MON", "Meal_Type": "Lunch",     "Is_Veg": False, "Event_Context": "Diwali_Week",      "Weather": "Sunny"},
    {"Day_of_Week": "TUE", "Meal_Type": "Breakfast",  "Is_Veg": True,  "Event_Context": "Diwali_Break",     "Weather": "Sunny"},
    {"Day_of_Week": "THU", "Meal_Type": "Lunch",     "Is_Veg": True,  "Event_Context": "Navratri_Festival", "Weather": "Sunny"},
    {"Day_of_Week": "SUN", "Meal_Type": "Dinner",    "Is_Veg": True,  "Event_Context": "Weekend",          "Weather": "Rainy"},
]

for s in scenarios:
    r = requests.post(f"{API}/predict", json=s)
    p = r.json()["prediction"]
    ctx = s["Event_Context"]
    meal = s["Meal_Type"]
    day = s["Day_of_Week"]
    w = s["Weather"]
    veg = "Veg" if s["Is_Veg"] else "NonVeg"
    print(f"  {day} {meal:10s} {veg:6s} {ctx:20s} {w:12s} => {p:6.0f} units")

# 4. Sanity checks
print("\n=== SANITY CHECKS ===")
# Vacation should be much lower than normal
r1 = requests.post(f"{API}/predict", json={"Day_of_Week": "MON", "Meal_Type": "Lunch", "Is_Veg": True, "Event_Context": "Normal", "Weather": "Sunny"})
r2 = requests.post(f"{API}/predict", json={"Day_of_Week": "MON", "Meal_Type": "Lunch", "Is_Veg": True, "Event_Context": "Winter_Vacation", "Weather": "Cold"})
p1, p2 = r1.json()["prediction"], r2.json()["prediction"]
print(f"  Normal weekday lunch:   {p1:.0f}")
print(f"  Vacation weekday lunch: {p2:.0f}")
print(f"  Ratio: {p2/p1:.2f} (should be < 0.3)")
check1 = "PASS" if p2/p1 < 0.3 else "FAIL"
print(f"  => {check1}")

# Exam week should be higher than normal
r3 = requests.post(f"{API}/predict", json={"Day_of_Week": "MON", "Meal_Type": "Lunch", "Is_Veg": True, "Event_Context": "End_Sem_Exams", "Weather": "Sunny"})
p3 = r3.json()["prediction"]
print(f"\n  Normal weekday lunch: {p1:.0f}")
print(f"  Exam weekday lunch:   {p3:.0f}")
check2 = "PASS" if p3 > p1 else "FAIL"
print(f"  Exam > Normal => {check2}")

# Weekend should be lower than weekday
r4 = requests.post(f"{API}/predict", json={"Day_of_Week": "SAT", "Meal_Type": "Lunch", "Is_Veg": True, "Event_Context": "Weekend", "Weather": "Sunny"})
p4 = r4.json()["prediction"]
print(f"\n  Weekday lunch:  {p1:.0f}")
print(f"  Weekend lunch:  {p4:.0f}")
check3 = "PASS" if p4 < p1 else "FAIL"
print(f"  Weekend < Weekday => {check3}")

# Heavy rain should reduce demand
r5 = requests.post(f"{API}/predict", json={"Day_of_Week": "MON", "Meal_Type": "Lunch", "Is_Veg": True, "Event_Context": "Normal", "Weather": "Heavy_Rain"})
p5 = r5.json()["prediction"]
print(f"\n  Normal sunny:      {p1:.0f}")
print(f"  Normal heavy rain: {p5:.0f}")
check4 = "PASS" if p5 < p1 else "FAIL"
print(f"  Rain < Sunny => {check4}")

all_pass = all(c == "PASS" for c in [check1, check2, check3, check4])
print(f"\n{'='*40}")
print(f"ALL SANITY CHECKS: {'PASSED' if all_pass else 'SOME FAILED'}")
print(f"{'='*40}")
