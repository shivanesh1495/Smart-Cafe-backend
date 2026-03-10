"""
Smart Cafe — AI Demand Forecasting API
──────────────────────────────────────
Production-grade ML pipeline using Gradient Boosting for
cafeteria demand prediction. 

Features:
  • Grouped event categories (reduces one-hot dimensionality)
  • Numeric + one-hot hybrid encoding
  • Gradient Boosting with regularization
  • Cross-validated training with detailed metrics
  • REST endpoints: /health, /predict, /analytics, /scenario-stats
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import os

app = Flask(__name__)
CORS(app)

# ══════════════════════════════════════════════
# Global state
# ══════════════════════════════════════════════
model = None
df = None
feature_columns = []         # columns the model was trained on
feature_importances = {}
metrics = {}
chart_data = []

# ══════════════════════════════════════════════
# Feature engineering helpers
# ══════════════════════════════════════════════

EVENT_GROUPS = {
    # High demand events
    "exam":     ["Mid_Sem_Exams", "End_Sem_Exams", "Lab_Exams", "Exam_Week"],
    "festival": ["Navratri_Festival", "Diwali_Week", "Holi_Festival",
                 "Makar_Sankranti", "Republic_Day", "Christmas",
                 "New_Year", "New_Year_Day", "New_Year_Eve",
                 "Festival_Week", "Diwali"],
    # Low demand events
    "vacation": ["Diwali_Break", "Winter_Vacation", "Summer_Vacation",
                 "Exam_End_Break", "Vacation_Start", "Post_Exam_Break",
                 "Pre_Reopen", "Holiday"],
    "weekend":  ["Weekend"],
    "disruption": ["Cyclone_Alert"],
    "normal":   ["Normal"],
    "special":  ["Cultural_Fest", "Orientation", "Reopen_Day",
                 "Exam_End_Party", "Last_Exam_Day", "Post_Festival_Return",
                 "Post_Cyclone", "Post_Festival", "Graduation"],
}

# Build reverse lookup
_EVENT_TO_GROUP = {}
for group, events in EVENT_GROUPS.items():
    for e in events:
        _EVENT_TO_GROUP[e] = group

DAY_MAP  = {"MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6}
MEAL_MAP = {"BREAKFAST": 0, "LUNCH": 1, "DINNER": 2, "SNACKS": 3}

WEATHER_MAP = {
    "Sunny": "clear", "Warm": "clear", "Hot": "clear",
    "Cloudy": "cloudy", "Normal": "cloudy",
    "Cool": "cold", "Cold": "cold", "ColD": "cold",
    "Rainy": "rainy", "Heavy_Rain": "rainy",
    "Humid": "cloudy",
}

# ── Maps for normalizing frontend-friendly input to dataset format ──
DAY_NAME_TO_ABBR = {
    "Monday": "MON", "Tuesday": "TUE", "Wednesday": "WED",
    "Thursday": "THU", "Friday": "FRI", "Saturday": "SAT", "Sunday": "SUN",
}
MEAL_NAME_TO_UPPER = {
    "Breakfast": "BREAKFAST", "Lunch": "LUNCH", "Dinner": "DINNER", "Snacks": "LUNCH",
}

def normalize_input(data: dict) -> dict:
    """Translate frontend-friendly input values to the format the training data uses."""
    out = dict(data)
    if "Day_of_Week" in out and out["Day_of_Week"] in DAY_NAME_TO_ABBR:
        out["Day_of_Week"] = DAY_NAME_TO_ABBR[out["Day_of_Week"]]
    if "Meal_Type" in out and out["Meal_Type"] in MEAL_NAME_TO_UPPER:
        out["Meal_Type"] = MEAL_NAME_TO_UPPER[out["Meal_Type"]]
    return out


def engineer_features(data: pd.DataFrame) -> pd.DataFrame:
    """Apply feature engineering to a DataFrame (works for both training and inference)."""
    feat = pd.DataFrame(index=data.index)

    # ── Numeric ordinals ──
    feat["Day_Num"] = data["Day_of_Week"].map(DAY_MAP).fillna(3).astype(int)
    feat["Is_Weekday"] = (feat["Day_Num"] < 5).astype(int)
    feat["Meal_Num"] = data["Meal_Type"].map(MEAL_MAP).fillna(1).astype(int)

    # ── Is_Veg (handle both bool and string columns) ──
    veg_col = data["Is_Veg"]
    if veg_col.dtype == object:
        feat["Is_Veg_Num"] = veg_col.map({"TRUE": 1, "FALSE": 0, "True": 1, "False": 0}).fillna(0).astype(int)
    else:
        feat["Is_Veg_Num"] = veg_col.astype(int)

    # ── Event group (reduces 25+ categories → 7) ──
    feat["Event_Group"] = data["Event_Context"].map(_EVENT_TO_GROUP).fillna("normal")

    # Binary flags for key demand drivers
    feat["Is_Exam"]     = (feat["Event_Group"] == "exam").astype(int)
    feat["Is_Festival"]  = (feat["Event_Group"] == "festival").astype(int)
    feat["Is_Vacation"]  = (feat["Event_Group"] == "vacation").astype(int)
    feat["Is_Weekend_Ev"] = (feat["Event_Group"] == "weekend").astype(int)
    feat["Is_Normal"]    = (feat["Event_Group"] == "normal").astype(int)
    feat["Is_Special"]   = (feat["Event_Group"] == "special").astype(int)
    feat["Is_Disruption"] = (feat["Event_Group"] == "disruption").astype(int)

    # ── Weather group ──
    feat["Weather_Group"] = data["Weather"].map(WEATHER_MAP).fillna("cloudy")
    feat["Is_Rainy"]  = (feat["Weather_Group"] == "rainy").astype(int)
    feat["Is_Cold"]   = (feat["Weather_Group"] == "cold").astype(int)
    feat["Is_Clear"]  = (feat["Weather_Group"] == "clear").astype(int)

    # ── One-hot for key categoricals ──
    day_oh  = pd.get_dummies(data["Day_of_Week"], prefix="Day")
    meal_oh = pd.get_dummies(data["Meal_Type"],   prefix="Meal")
    wg_oh   = pd.get_dummies(feat["Weather_Group"], prefix="Wtr")
    eg_oh   = pd.get_dummies(feat["Event_Group"],   prefix="Evt")

    # Drop helper text columns before concat
    feat = feat.drop(columns=["Event_Group", "Weather_Group"])

    feat = pd.concat([feat, day_oh, meal_oh, wg_oh, eg_oh], axis=1)
    return feat


# ══════════════════════════════════════════════
# Training
# ══════════════════════════════════════════════

def load_and_train():
    global model, df, feature_columns, feature_importances, metrics, chart_data

    print("Loading data and training forecasting model...")
    try:
        csv_path = "cafeteria_data_full_quarter.csv"
        if not os.path.exists(csv_path):
            print(f"ERROR: {csv_path} not found.")
            return

        df = pd.read_csv(csv_path)
        print(f"Data loaded. Total records: {len(df)}")

        target = "Qty_Consumed"
        if target not in df.columns:
            print(f"ERROR: Target column '{target}' not found.")
            return

        # Feature engineering
        X = engineer_features(df)
        y = df[target].values

        # Save column order for inference alignment
        feature_columns = X.columns.tolist()

        # Train / test split (stratification-friendly)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # ── Gradient Boosting with regularization ──
        model = GradientBoostingRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.08,
            min_samples_split=10,
            min_samples_leaf=5,
            subsample=0.85,
            max_features="sqrt",
            random_state=42,
        )
        model.fit(X_train, y_train)

        # Predictions
        y_pred_train = model.predict(X_train)
        y_pred_test  = model.predict(X_test)

        # ── Metrics ──
        mae_train = mean_absolute_error(y_train, y_pred_train)
        mae_test  = mean_absolute_error(y_test,  y_pred_test)
        mape_test = np.mean(np.abs((y_test - y_pred_test) / np.maximum(y_test, 1))) * 100
        rmse_test = np.sqrt(np.mean((y_test - y_pred_test) ** 2))
        r2_test   = r2_score(y_test, y_pred_test)

        # Cross-validation
        cv_scores = cross_val_score(model, X, y, cv=5, scoring="neg_mean_absolute_error")
        cv_mae = -cv_scores.mean()

        metrics = {
            "mae_train": round(mae_train, 2),
            "mae_test":  round(mae_test, 2),
            "mape":      round(mape_test, 2),
            "rmse":      round(rmse_test, 2),
            "r2":        round(r2_test, 4),
            "cv_mae":    round(cv_mae, 2),
        }

        # Feature importances
        importances = model.feature_importances_
        feature_importances = dict(
            sorted(
                zip(feature_columns, importances),
                key=lambda x: x[1],
                reverse=True,
            )
        )

        # Chart data (subset of test predictions)
        test_indices = list(range(min(20, len(y_test))))
        chart_data = []
        for i in test_indices:
            idx = X_test.index[i]
            row = df.loc[idx]
            chart_data.append({
                "day": f"{str(row['Day_of_Week'])[:3]}",
                "meal": str(row.get("Meal_Type", "")),
                "event": str(row.get("Event_Context", "")),
                "actual": int(row[target]),
                "predicted": int(round(y_pred_test[i])),
            })

        print(f"Model trained successfully!")
        print(f"  MAE (train): {metrics['mae_train']}")
        print(f"  MAE (test):  {metrics['mae_test']}")
        print(f"  MAPE:        {metrics['mape']}%")
        print(f"  RMSE:        {metrics['rmse']}")
        print(f"  R2:          {metrics['r2']}")
        print(f"  CV MAE:      {metrics['cv_mae']}")

    except Exception as e:
        print(f"ERROR during training: {e}")
        import traceback
        traceback.print_exc()


# Train on startup
load_and_train()


# ══════════════════════════════════════════════
# API Endpoints
# ══════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Forecasting API",
        "model_loaded": model is not None,
        "records": len(df) if df is not None else 0,
    })


@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not trained"}), 500

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Normalize frontend-friendly values to dataset format
        data = normalize_input(data)

        # Build single-row DataFrame
        input_df = pd.DataFrame([data])

        # Defaults
        if "Event_Context" not in input_df.columns:
            input_df["Event_Context"] = "Normal"
        if "Weather" not in input_df.columns:
            input_df["Weather"] = "Sunny"
        if "Is_Veg" not in input_df.columns:
            input_df["Is_Veg"] = True

        # Engineer features and align columns
        X_input = engineer_features(input_df)
        X_input = X_input.reindex(columns=feature_columns, fill_value=0)

        prediction = model.predict(X_input)[0]

        return jsonify({
            "prediction": round(float(prediction), 2),
            "input": data,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/scenario-stats", methods=["POST"])
def scenario_stats():
    if model is None or df is None:
        return jsonify({"error": "Model not loaded"}), 500

    try:
        filters = request.json
        if not filters:
            return jsonify({"error": "No filters provided"}), 400

        # Normalize frontend-friendly values to dataset format
        filters = normalize_input(filters)

        filtered = df.copy()
        if "Day_of_Week" in filters:
            filtered = filtered[filtered["Day_of_Week"] == filters["Day_of_Week"]]
        if "Meal_Type" in filters:
            filtered = filtered[filtered["Meal_Type"] == filters["Meal_Type"]]

        sample = filtered.head(20)
        if sample.empty:
            return jsonify({"message": "No data found", "chart_data": []})

        X_sample = engineer_features(sample)
        X_sample = X_sample.reindex(columns=feature_columns, fill_value=0)
        preds = model.predict(X_sample)

        result_chart = []
        for i, (idx, row) in enumerate(sample.iterrows()):
            result_chart.append({
                "day": f"{str(row['Day_of_Week'])[:3]} {i + 1}",
                "actual": int(row["Qty_Consumed"]),
                "predicted": int(round(preds[i])),
            })

        return jsonify({
            "chart_data": result_chart,
            "count": len(result_chart),
        })

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500


@app.route("/analytics", methods=["GET"])
def analytics():
    if df is None:
        return jsonify({"error": "Data not loaded"}), 500

    try:
        total_records = len(df)
        avg_demand = float(df["Qty_Consumed"].mean())

        top_drivers = [
            {"factor": k, "importance": float(v)}
            for k, v in list(feature_importances.items())[:5]
        ]

        return jsonify({
            "total_records": total_records,
            "average_demand": round(avg_demand, 2),
            "metrics": metrics,
            "top_drivers": top_drivers,
            "chart_data": chart_data,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/retrain", methods=["POST"])
def retrain():
    """Reload CSV data and retrain the model with the latest data."""
    try:
        load_and_train()
        if model is None:
            return jsonify({"error": "Retraining failed"}), 500
        return jsonify({
            "status": "retrained",
            "records": len(df) if df is not None else 0,
            "metrics": metrics,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ══════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════

if __name__ == "__main__":
    from waitress import serve
    print("Starting Forecasting API on port 5001 (Waitress, 4 threads)...")
    serve(app, host="0.0.0.0", port=5001, threads=4)

