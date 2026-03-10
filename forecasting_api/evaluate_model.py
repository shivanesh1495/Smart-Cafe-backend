"""
Deep evaluation of the cafeteria demand forecasting model.
Checks: dataset quality, feature engineering, model accuracy, 
prediction reliability per scenario.
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings
warnings.filterwarnings('ignore')

CSV_PATH = 'cafeteria_data_full_quarter.csv'

# ──────────────────────────────────────────────
# 1. DATA QUALITY AUDIT
# ──────────────────────────────────────────────
print("=" * 60)
print("1. DATA QUALITY AUDIT")
print("=" * 60)
df = pd.read_csv(CSV_PATH)
print(f"Total records: {len(df)}")
print(f"Columns: {list(df.columns)}")
print(f"\nMissing values:\n{df.isnull().sum()}")
print(f"\nTarget (Qty_Consumed) stats:\n{df['Qty_Consumed'].describe()}")
print(f"\nMeal_Type distribution:\n{df['Meal_Type'].value_counts()}")
print(f"\nDay_of_Week distribution:\n{df['Day_of_Week'].value_counts()}")
print(f"\nEvent_Context distribution:\n{df['Event_Context'].value_counts()}")
print(f"\nWeather distribution:\n{df['Weather'].value_counts()}")

# Check for data leakage
corr = df[['Qty_Prepared', 'Qty_Consumed', 'Waste_Qty']].corr()
print(f"\nCorrelation matrix:\n{corr}")

# ──────────────────────────────────────────────
# 2. REPRODUCE CURRENT MODEL (from api.py)
# ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("2. CURRENT MODEL (api.py)")
print("=" * 60)

target = 'Qty_Consumed'
features = ['Day_of_Week', 'Meal_Type', 'Is_Veg', 'Event_Context', 'Weather']

df_eval = df.copy()
df_eval['Is_Exam_Week'] = df_eval['Event_Context'].astype(str).str.contains('exam', case=False, na=False)
df_eval['Is_Holiday'] = df_eval['Event_Context'].astype(str).str.contains('holiday|break', case=False, na=False)
df_eval['Is_Graduation'] = df_eval['Event_Context'].astype(str).str.contains('graduation|convocation', case=False, na=False)

features_to_use = features + ['Is_Exam_Week', 'Is_Holiday', 'Is_Graduation']
X = pd.get_dummies(df_eval[features_to_use])
y = df_eval[target]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model_current = RandomForestRegressor(n_estimators=100, random_state=42)
model_current.fit(X_train, y_train)
y_pred = model_current.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)
mape = np.mean(np.abs((y_test - y_pred) / np.maximum(y_test, 1))) * 100
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print(f"MAE:  {mae:.2f}")
print(f"MAPE: {mape:.2f}%")
print(f"RMSE: {rmse:.2f}")
print(f"R2:   {r2:.4f}")

cv_scores = cross_val_score(model_current, X, y, cv=5, scoring='neg_mean_absolute_error')
print(f"5-Fold CV MAE: {-cv_scores.mean():.2f} (+/- {cv_scores.std():.2f})")

# Per-sample breakdown
results_df = pd.DataFrame({
    'Actual': y_test.values,
    'Predicted': np.round(y_pred, 1),
    'Error': np.round(np.abs(y_test.values - y_pred), 1),
    'Error%': np.round(np.abs(y_test.values - y_pred) / np.maximum(y_test.values, 1) * 100, 1),
})
results_df.index = y_test.index
big_errors = results_df[results_df['Error%'] > 30]
print(f"\nPredictions with >30% error: {len(big_errors)} / {len(results_df)} ({len(big_errors)/len(results_df)*100:.1f}%)")

print("\nTop 10 worst predictions:")
print(results_df.sort_values('Error%', ascending=False).head(10).to_string())

# Feature importance
importances = pd.Series(model_current.feature_importances_, index=X.columns)
print(f"\nTop 10 features:\n{importances.sort_values(ascending=False).head(10)}")

# ──────────────────────────────────────────────
# 3. IMPROVED MODEL
# ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("3. IMPROVED MODELS")
print("=" * 60)

df2 = df.copy()

# Better boolean Is_Veg handling
df2['Is_Veg_Num'] = df2['Is_Veg'].map({True: 1, False: 0, 'TRUE': 1, 'FALSE': 0}).fillna(0).astype(int)

# Richer event context features
df2['Is_Exam'] = df2['Event_Context'].str.contains('Exam|exam|Lab_Exam', case=False, na=False).astype(int)
df2['Is_Holiday'] = df2['Event_Context'].str.contains('Holiday|Vacation|Break|Diwali_Break|Winter_Vacation', case=False, na=False).astype(int)
df2['Is_Festival'] = df2['Event_Context'].str.contains('Festival|Diwali|Christmas|Sankranti|Republic|New_Year', case=False, na=False).astype(int)
df2['Is_Weekend'] = df2['Event_Context'].str.contains('Weekend', case=False, na=False).astype(int)
df2['Is_Normal'] = (df2['Event_Context'] == 'Normal').astype(int)

df2['Is_Rainy'] = df2['Weather'].str.contains('Rain|rain|Rainy|Heavy_Rain', case=False, na=False).astype(int)
df2['Is_Cold'] = df2['Weather'].str.contains('Cold|Cool', case=False, na=False).astype(int)
df2['Is_Sunny'] = df2['Weather'].str.contains('Sunny', case=False, na=False).astype(int)

day_map = {'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4, 'SAT': 5, 'SUN': 6}
df2['Day_Num'] = df2['Day_of_Week'].map(day_map).fillna(3)
df2['Is_Weekday'] = (df2['Day_Num'] < 5).astype(int)

meal_map = {'BREAKFAST': 0, 'LUNCH': 1, 'DINNER': 2, 'SNACKS': 3}
df2['Meal_Num'] = df2['Meal_Type'].map(meal_map).fillna(1)

features_v2 = [
    'Day_Num', 'Is_Weekday', 'Meal_Num', 'Is_Veg_Num',
    'Is_Exam', 'Is_Holiday', 'Is_Festival', 'Is_Weekend', 'Is_Normal',
    'Is_Rainy', 'Is_Cold', 'Is_Sunny',
]

cat_features = ['Day_of_Week', 'Meal_Type', 'Weather']
X2_cat = pd.get_dummies(df2[cat_features], prefix=cat_features)
X2 = pd.concat([df2[features_v2], X2_cat], axis=1)
y2 = df2[target]

X2_train, X2_test, y2_train, y2_test = train_test_split(X2, y2, test_size=0.2, random_state=42)

# Tuned RF
model_v2_rf = RandomForestRegressor(n_estimators=200, max_depth=12, min_samples_split=5, min_samples_leaf=3, random_state=42)
model_v2_rf.fit(X2_train, y2_train)
y2_pred_rf = model_v2_rf.predict(X2_test)

mae2_rf = mean_absolute_error(y2_test, y2_pred_rf)
mape2_rf = np.mean(np.abs((y2_test - y2_pred_rf) / np.maximum(y2_test, 1))) * 100
rmse2_rf = np.sqrt(mean_squared_error(y2_test, y2_pred_rf))
r2_2_rf = r2_score(y2_test, y2_pred_rf)

print(f"[Improved RF] MAE: {mae2_rf:.2f}, MAPE: {mape2_rf:.2f}%, RMSE: {rmse2_rf:.2f}, R2: {r2_2_rf:.4f}")
cv2_rf = cross_val_score(model_v2_rf, X2, y2, cv=5, scoring='neg_mean_absolute_error')
print(f"[Improved RF] 5-Fold CV MAE: {-cv2_rf.mean():.2f}")

# Gradient Boosting
model_v2_gb = GradientBoostingRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, min_samples_split=5, min_samples_leaf=3, random_state=42)
model_v2_gb.fit(X2_train, y2_train)
y2_pred_gb = model_v2_gb.predict(X2_test)

mae2_gb = mean_absolute_error(y2_test, y2_pred_gb)
mape2_gb = np.mean(np.abs((y2_test - y2_pred_gb) / np.maximum(y2_test, 1))) * 100
rmse2_gb = np.sqrt(mean_squared_error(y2_test, y2_pred_gb))
r2_2_gb = r2_score(y2_test, y2_pred_gb)

print(f"[Gradient Boost] MAE: {mae2_gb:.2f}, MAPE: {mape2_gb:.2f}%, RMSE: {rmse2_gb:.2f}, R2: {r2_2_gb:.4f}")
cv2_gb = cross_val_score(model_v2_gb, X2, y2, cv=5, scoring='neg_mean_absolute_error')
print(f"[Gradient Boost] 5-Fold CV MAE: {-cv2_gb.mean():.2f}")

# ──────────────────────────────────────────────
# 4. COMPARISON
# ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("4. COMPARISON SUMMARY")
print("=" * 60)

print(f"{'Model':<25} {'MAE':<8} {'MAPE%':<8} {'RMSE':<8} {'R2':<8} {'CV MAE':<8}")
print("-" * 65)
print(f"{'Current (api.py)':<25} {mae:<8.2f} {mape:<8.2f} {rmse:<8.2f} {r2:<8.4f} {-cv_scores.mean():<8.2f}")
print(f"{'Improved RF':<25} {mae2_rf:<8.2f} {mape2_rf:<8.2f} {rmse2_rf:<8.2f} {r2_2_rf:<8.4f} {-cv2_rf.mean():<8.2f}")
print(f"{'Gradient Boosting':<25} {mae2_gb:<8.2f} {mape2_gb:<8.2f} {rmse2_gb:<8.2f} {r2_2_gb:<8.4f} {-cv2_gb.mean():<8.2f}")

# Per-meal & event detail for best model
best_pred = y2_pred_gb if r2_2_gb > r2_2_rf else y2_pred_rf
best_name = "Gradient Boosting" if r2_2_gb > r2_2_rf else "Improved RF"
print(f"\nBest model: {best_name}")

test_df = df2.iloc[y2_test.index].copy()
test_df['Predicted'] = best_pred
test_df['Error'] = np.abs(test_df['Qty_Consumed'] - test_df['Predicted'])
test_df['Error_Pct'] = test_df['Error'] / np.maximum(test_df['Qty_Consumed'], 1) * 100

print("\n--- Per Meal Type ---")
for meal in ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS']:
    subset = test_df[test_df['Meal_Type'] == meal]
    if len(subset) > 0:
        print(f"  {meal}: MAE={subset['Error'].mean():.1f}, MAPE={subset['Error_Pct'].mean():.1f}%, n={len(subset)}")

print("\n--- Per Event Context ---")
for ctx in sorted(test_df['Event_Context'].unique()):
    subset = test_df[test_df['Event_Context'] == ctx]
    if len(subset) > 0:
        print(f"  {ctx}: MAE={subset['Error'].mean():.1f}, MAPE={subset['Error_Pct'].mean():.1f}%, n={len(subset)}")

print("\n--- Sample Predictions ---")
sample = test_df[['Day_of_Week', 'Meal_Type', 'Event_Context', 'Weather', 'Qty_Consumed', 'Predicted', 'Error_Pct']].copy()
sample['Predicted'] = sample['Predicted'].round(0).astype(int)
sample['Error_Pct'] = sample['Error_Pct'].round(1)
print(sample.head(25).to_string())
