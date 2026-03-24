# ML Models — UHI Mitigation Planner

## 1. CNN Hotspot Classifier

**Architecture:** ResNet-50 (transfer learning)  
**Task:** Multi-class UHI risk classification (5 classes)  
**Input:** 256×256 multi-band satellite tiles (Landsat 9 / Sentinel-2)  
**Output:** Risk class per pixel — Very Low / Low / Moderate / High / Extreme  

**Training:**
- Epochs: 50
- Optimizer: Adam (lr=0.001)
- Loss: Categorical Cross-Entropy
- F1-Score: 91.4%
- Val Loss: ~0.08

**Bands used:**
- B4 (Red), B5 (NIR) → NDVI
- B10 (Thermal) → LST estimation
- B6, B7 → Impervious surface
- B2 (Blue) for visualization

---

## 2. LSTM Forecaster

**Architecture:** 2-layer LSTM + Dense output  
**Task:** LST time-series forecasting  
**Input:** 30-day rolling window of weather + LST features  
**Output:** 30-day / 90-day / Seasonal LST forecast  

**Training:**
- Sequence Length: 30 days
- Hidden Units: 128 → 64
- Dropout: 0.2
- RMSE: 0.82°C
- MAE: 0.61°C

---

## 3. Intervention Optimizer

**Type:** Rule-based + Cost-benefit scoring  
**Logic:**
1. Rank interventions by cooling/cost ratio
2. Filter by zone risk tier (Critical/High/Moderate/Low)
3. Score equity impact (low-income zone weighting)
4. Output top-N recommendations per zone

---

## Training Data Sources

| Source | Type | Resolution |
|--------|------|-----------|
| Landsat 9 | Thermal + Multispectral | 30m / 100m |
| Sentinel-2 | Multispectral | 10m |
| MODIS LST | Land Surface Temp | 1km |
| IMD Pune | Weather ground truth | Station |
| OSM | Land-use classification | Vector |
| PMC GIS | Ward boundaries | Vector |

---

## How to Retrain (Python)

```bash
pip install tensorflow keras rasterio geopandas scikit-learn

# Preprocess
python models/preprocess.py --input data/landsat/ --output data/processed/

# Train CNN
python models/train_cnn.py --epochs 50 --batch 32

# Train LSTM
python models/train_lstm.py --sequence 30 --forecast 30

# Evaluate
python models/evaluate.py --model checkpoints/cnn_best.h5
```

*(These Python training scripts are placeholders — implement with your actual satellite data)*
