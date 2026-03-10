"""
Generate a realistic, large cafeteria demand dataset (~2000+ records).
Covers one full academic year with realistic seasonal patterns,
event-driven demand shifts, and weather effects.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

random.seed(42)
np.random.seed(42)

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

# Academic calendar events (date ranges → context label)
EVENTS = [
    # Semester 1 (Aug-Dec 2025)
    ("2025-08-01", "2025-08-03", "Orientation"),
    ("2025-08-04", "2025-11-28", "Normal"),          # Regular semester
    ("2025-09-15", "2025-09-19", "Mid_Sem_Exams"),
    ("2025-10-01", "2025-10-05", "Navratri_Festival"),
    ("2025-10-20", "2025-10-24", "Diwali_Week"),
    ("2025-10-25", "2025-10-29", "Diwali_Break"),
    ("2025-11-10", "2025-11-14", "Lab_Exams"),
    ("2025-11-24", "2025-12-05", "End_Sem_Exams"),
    ("2025-12-06", "2025-12-10", "Exam_End_Break"),
    ("2025-12-11", "2025-12-31", "Winter_Vacation"),
    ("2025-12-25", "2025-12-25", "Christmas"),
    # Semester 2 (Jan-May 2026)
    ("2026-01-01", "2026-01-01", "New_Year"),
    ("2026-01-02", "2026-01-05", "Winter_Vacation"),
    ("2026-01-06", "2026-01-06", "Reopen_Day"),
    ("2026-01-07", "2026-04-30", "Normal"),
    ("2026-01-14", "2026-01-14", "Makar_Sankranti"),
    ("2026-01-26", "2026-01-26", "Republic_Day"),
    ("2026-02-16", "2026-02-20", "Mid_Sem_Exams"),
    ("2026-03-10", "2026-03-14", "Holi_Festival"),
    ("2026-04-01", "2026-04-05", "Cultural_Fest"),
    ("2026-04-20", "2026-05-01", "End_Sem_Exams"),
    ("2026-05-02", "2026-05-31", "Summer_Vacation"),
]

MEALS = ["BREAKFAST", "LUNCH", "DINNER"]
DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

# Dishes per meal type
DISHES = {
    "BREAKFAST": [
        ("Idli Sambar", True), ("Pongal", True), ("Poha", True),
        ("Aloo Paratha", True), ("Masala Dosa", True), ("Chana Masala", True),
        ("Bread Omelette", False), ("Egg Bhurji", False),
    ],
    "LUNCH": [
        ("Sambar Rice", True), ("Rajma Chawal", True), ("Paneer Butter Masala", True),
        ("Dal Makhani", True), ("Veg Biryani", True), ("Aloo Gobi", True),
        ("Kadhi Pakora", True), ("Dal Fry", True), ("Mix Veg Curry", True),
        ("Chicken Biryani", False), ("Chicken Curry", False), ("Fish Curry", False),
        ("Egg Curry", False), ("Mutton Curry", False), ("Fish Fry", False),
    ],
    "DINNER": [
        ("Chapati Kurma", True), ("Rasam Rice", True), ("Paneer Tikka", True),
        ("Veg Fried Rice", True), ("Aloo Palak", True), ("Curd Rice", True),
        ("Chicken Tikka", False), ("Egg Fried Rice", False),
        ("Prawn Masala", False), ("Tandoori Chicken", False),
    ],
}

# Weather patterns by month (Chennai/South India style)
WEATHER_BY_MONTH = {
    1:  ["Sunny", "Cool", "Cloudy"],
    2:  ["Sunny", "Sunny", "Warm"],
    3:  ["Sunny", "Warm", "Hot"],
    4:  ["Hot", "Hot", "Sunny"],
    5:  ["Hot", "Hot", "Sunny", "Humid"],
    6:  ["Rainy", "Cloudy", "Humid"],
    7:  ["Rainy", "Heavy_Rain", "Cloudy"],
    8:  ["Rainy", "Cloudy", "Humid"],
    9:  ["Rainy", "Cloudy", "Sunny"],
    10: ["Sunny", "Cloudy", "Rainy"],
    11: ["Cool", "Cloudy", "Rainy", "Heavy_Rain"],
    12: ["Cool", "Cold", "Cloudy"],
}

def get_event_context(date):
    """Get event context for a given date, with priority ordering."""
    date_str = date.strftime("%Y-%m-%d")
    # Check events in reverse (later entries have priority)
    for start_str, end_str, ctx in reversed(EVENTS):
        if start_str <= date_str <= end_str:
            return ctx
    # If weekend
    if date.weekday() >= 5:
        return "Weekend"
    return "Normal"

def get_base_demand(meal, day_of_week, is_veg):
    """Base demand by meal type and day."""
    bases = {
        "BREAKFAST": {"weekday": 250, "weekend": 120},
        "LUNCH":     {"weekday": 280, "weekend": 140},
        "DINNER":    {"weekday": 200, "weekend": 100},
    }
    day_type = "weekend" if day_of_week >= 5 else "weekday"
    base = bases[meal][day_type]
    
    # Non-veg is typically lower demand in Indian cafeteria
    if not is_veg:
        base = int(base * 0.75)
    
    return base

def apply_event_modifier(base, event_context):
    """Modify demand based on event context."""
    modifiers = {
        "Normal": 1.0,
        "Weekend": 0.55,
        "Orientation": 1.2,
        "Mid_Sem_Exams": 1.15,
        "End_Sem_Exams": 1.1,
        "Lab_Exams": 1.05,
        "Exam_End_Break": 0.3,
        "Diwali_Week": 1.3,
        "Diwali_Break": 0.15,
        "Navratri_Festival": 1.25,
        "Holi_Festival": 1.2,
        "Cultural_Fest": 1.35,
        "Winter_Vacation": 0.1,
        "Summer_Vacation": 0.08,
        "Christmas": 0.25,
        "New_Year": 0.2,
        "Reopen_Day": 0.85,
        "Makar_Sankranti": 1.15,
        "Republic_Day": 1.1,
    }
    return int(base * modifiers.get(event_context, 1.0))

def apply_weather_modifier(base, weather):
    """Weather effects on demand."""
    modifiers = {
        "Sunny": 1.0,
        "Warm": 0.95,
        "Hot": 0.85,
        "Humid": 0.9,
        "Cool": 1.05,
        "Cold": 1.08,
        "Cloudy": 0.97,
        "Rainy": 0.8,
        "Heavy_Rain": 0.65,
    }
    return int(base * modifiers.get(weather, 1.0))

def generate_dataset():
    records = []
    start_date = datetime(2025, 8, 1)
    end_date = datetime(2026, 5, 31)
    
    current = start_date
    while current <= end_date:
        event_ctx = get_event_context(current)
        month = current.month
        day_of_week = current.weekday()
        day_abbr = DAYS[day_of_week]
        weather = random.choice(WEATHER_BY_MONTH[month])
        
        for meal in MEALS:
            # Pick 1-2 dishes per meal
            dish_pool = DISHES[meal]
            num_dishes = random.choice([1, 2])
            chosen = random.sample(dish_pool, min(num_dishes, len(dish_pool)))
            
            for dish_name, is_veg in chosen:
                base = get_base_demand(meal, day_of_week, is_veg)
                demand = apply_event_modifier(base, event_ctx)
                demand = apply_weather_modifier(demand, weather)
                
                # Add random noise (±10%)
                noise = np.random.normal(0, 0.08)
                demand = max(5, int(demand * (1 + noise)))
                
                # Qty_Prepared is always >= Qty_Consumed (kitchen over-prepares by 5-25%)
                over_prep_pct = np.random.uniform(0.05, 0.25)
                qty_prepared = int(demand * (1 + over_prep_pct))
                
                # Actual consumption can vary from demand
                consumption_noise = np.random.normal(0, 0.05)
                qty_consumed = max(3, int(demand * (1 + consumption_noise)))
                qty_consumed = min(qty_consumed, qty_prepared)  # Can't eat more than prepared
                
                waste = qty_prepared - qty_consumed
                
                records.append({
                    "Date": current.strftime("%d-%m-%Y"),
                    "Day_of_Week": day_abbr,
                    "Meal_Type": meal,
                    "Main_Dish": dish_name,
                    "Is_Veg": is_veg,
                    "Event_Context": event_ctx,
                    "Weather": weather,
                    "Qty_Prepared": qty_prepared,
                    "Qty_Consumed": qty_consumed,
                    "Waste_Qty": waste,
                })
        
        current += timedelta(days=1)
    
    return pd.DataFrame(records)

# Generate
df = generate_dataset()
print(f"Generated {len(df)} records")
print(f"Date range: {df['Date'].iloc[0]} to {df['Date'].iloc[-1]}")
print(f"\nMeal distribution:\n{df['Meal_Type'].value_counts()}")
print(f"\nEvent distribution:\n{df['Event_Context'].value_counts()}")
print(f"\nWeather distribution:\n{df['Weather'].value_counts()}")
print(f"\nQty_Consumed stats:\n{df['Qty_Consumed'].describe()}")

# Save
output_path = 'cafeteria_data_full_quarter.csv'
df.to_csv(output_path, index=False)
print(f"\nSaved to {output_path}")
