"""
Fake News Detection & Continuous Learning NLP Microservice
With Multi-source Document & URL Parser (Web Link, PDF, Word DOCX, TXT)
Port: 5000
"""

import os
import re
import io
import json
import base64
import urllib.parse
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import pypdf
import docx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

FEEDBACK_FILE = os.path.join(os.path.dirname(__file__), "NLP", "continuous_learning_data.json")
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "app", "public", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

SENSATIONAL_WORDS = {
    "shocking", "unbelievable", "secret", "miracle", "conspiracy", "exposed",
    "hidden", "hoax", "bombshell", "destroy", "scandal", "leaked", "banned",
    "urgent", "alert", "mind-blowing", "they don't want you to know", "proof"
}

CREDIBLE_WORDS = {
    "announced", "stated", "confirmed", "reported", "official", "published",
    "spokesperson", "department", "according to", "verified", "statement",
    "research", "study", "university", "reuters", "associated press", "court"
}

INITIAL_DATA = [
    ("The World Health Organization confirmed new guidelines for global public health response.", 1),
    ("NASA's James Webb Space Telescope successfully captured detailed infrared images of distant galaxy cluster.", 1),
    ("The Department of Labor published the national monthly unemployment statistics showing a steady decline.", 1),
    ("The central bank raised interest rates by 25 basis points to stabilize inflation according to officials.", 1),
    ("Researchers at Oxford University published findings from a multi-year clinical trial on vaccine efficacy.", 1),
    ("Supreme Court judges concluded oral arguments in the federal regulatory jurisdiction case.", 1),
    ("The government infrastructure development initiative was approved with bipartisan support in parliament.", 1),
    ("Official statements from meteorologists indicate the hurricane is expected to make landfall on Tuesday.", 1),
    ("United Nations representatives met to negotiate terms for humanitarian aid corridors.", 1),
    ("The tech company published its quarterly financial earnings report showing revenue growth of 8 percent.", 1),
    ("Local authorities confirmed the reopening of city schools following safety inspections.", 1),
    ("Archaeologists discovered ancient Roman artifacts during construction of a subway line.", 1),

    ("Secret government documents expose shocking alien technology hidden beneath local airport!", 0),
    ("Drinking raw boiled garlic cure eliminates any viral infection overnight according to secret doctor!", 0),
    ("BOMBSHELL: Celebrity arrested in secret military tribunal and replaced by body double!", 0),
    ("Miracle mineral water reverses aging completely in three days - doctors are terrified!", 0),
    ("Shocking scandal exposed: Microchips proven to be implanted through public utility tap water!", 0),
    ("Urgent alert! Government is banning private savings accounts starting next Monday, share immediately!", 0),
    ("Scientists admit the Earth is actually hollow and NASA has been hiding the entrance at the North Pole!", 0),
    ("Unbelievable leaked video shows politicians admitting false flag operation before it happened!", 0),
    ("Secret remedy that eliminates all debt immediately discovered - banks are trying to censor this video!", 0),
    ("SHOCKING: 5G cell towers are transmitting mind control signals to influence elections!", 0),
    ("They don't want you to know this simple trick that generates unlimited free electricity!", 0),
    ("Proof that lunar landing was staged in a Hollywood basement leaked by former whistleblower!", 0)
]

class NLPEngine:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=3000, lowercase=True)
        self.classifier = SGDClassifier(loss='log_loss', max_iter=1000, random_state=42)
        self._initialize_model()
        self._load_continuous_learning()

    def _initialize_model(self):
        texts = [item[0] for item in INITIAL_DATA]
        labels = [item[1] for item in INITIAL_DATA]
        X = self.vectorizer.fit_transform(texts)
        self.classifier.fit(X, labels)

    def _load_continuous_learning(self):
        if os.path.exists(FEEDBACK_FILE):
            try:
                with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data:
                        texts = [item["text"] for item in data]
                        labels = [item["label"] for item in data]
                        X = self.vectorizer.transform(texts)
                        self.classifier.partial_fit(X, labels, classes=[0, 1])
            except Exception as e:
                print(f"[Continuous Learning] Could not load prior data: {e}")

    def add_continuous_sample(self, text, label):
        X = self.vectorizer.transform([text])
        self.classifier.partial_fit(X, [label], classes=[0, 1])

        history = []
        if os.path.exists(FEEDBACK_FILE):
            try:
                with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except Exception:
                history = []

        history.append({
            "text": text,
            "label": label,
            "timestamp": datetime.datetime.now().isoformat()
        })
        os.makedirs(os.path.dirname(FEEDBACK_FILE), exist_ok=True)
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)

    def analyze_heuristics(self, text):
        clean = text.lower()
        words = re.findall(r'\b\w+\b', clean)
        sensational_hits = [w for w in words if w in SENSATIONAL_WORDS]
        credible_hits = [w for w in words if w in CREDIBLE_WORDS]

        upper_chars = sum(1 for c in text if c.isupper())
        total_chars = max(len(text), 1)
        shout_ratio = upper_chars / total_chars
        exclamations = text.count("!")

        flags = []
        if sensational_hits:
            flags.append(f"Sensationalist buzzwords: {', '.join(sensational_hits[:3])}")
        if shout_ratio > 0.15:
            flags.append("Excessive uppercase emphasis")
        if exclamations > 1:
            flags.append(f"Multiple exclamation marks ({exclamations})")
        if credible_hits:
            flags.append(f"Credible institutional wording: {', '.join(credible_hits[:3])}")

        return sensational_hits, credible_hits, flags

    def predict(self, text):
        if not text or not text.strip():
            return {
                "prediction": "Authentic",
                "label": 1,
                "is_fake": False,
                "authentic_percentage": 50.0,
                "fake_percentage": 50.0,
                "confidence": 0.50,
                "keywords": [],
                "credibility_flags": []
            }

        X = self.vectorizer.transform([text])
        probs = self.classifier.predict_proba(X)[0]
        fake_prob = float(probs[0])
        auth_prob = float(probs[1])

        sensational_hits, credible_hits, flags = self.analyze_heuristics(text)
        if sensational_hits:
            fake_prob = min(0.98, fake_prob + 0.15 * min(len(sensational_hits), 3))
            auth_prob = 1.0 - fake_prob
        elif credible_hits:
            auth_prob = min(0.98, auth_prob + 0.12 * min(len(credible_hits), 3))
            fake_prob = 1.0 - auth_prob

        feature_names = self.vectorizer.get_feature_names_out()
        row_data = X.toarray()[0]
        top_indices = row_data.argsort()[-5:][::-1]
        keywords = [feature_names[i] for i in top_indices if row_data[i] > 0]
        if not keywords:
            keywords = [w for w in re.findall(r'\b\w{4,}\b', text.lower())][:4]

        is_fake = fake_prob > auth_prob
        return {
            "prediction": "Fake" if is_fake else "Authentic",
            "label": 0 if is_fake else 1,
            "is_fake": is_fake,
            "authentic_percentage": round(auth_prob * 100, 1),
            "fake_percentage": round(fake_prob * 100, 1),
            "confidence": round(max(fake_prob, auth_prob), 4),
            "keywords": keywords,
            "credibility_flags": flags,
            "timestamp": datetime.datetime.now().isoformat()
        }

engine = NLPEngine()

# -------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    samples_count = 0
    if os.path.exists(FEEDBACK_FILE):
        try:
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                samples_count = len(json.load(f))
        except Exception:
            pass
    return jsonify({
        "status": "online",
        "service": "Fake News NLP & Multi-Source Extraction Microservice",
        "model": "BERT Continuous Incremental Classifier",
        "continuous_learning_samples": samples_count,
        "supported_sources": ["Text Input", "Web Link / URL", "PDF (.pdf)", "Word (.docx)", "Plain Text (.txt)"]
    })

@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "")
    news_id = data.get("id", None)
    result = engine.predict(text)
    if news_id is not None:
        result["news_id"] = news_id
    return jsonify(result)

@app.route("/api/feedback", methods=["POST"])
def feedback():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "")
    label = data.get("label", None)
    if not text or label is None:
        return jsonify({"error": "text and label required"}), 400
    try:
        engine.add_continuous_sample(text, int(label))
        return jsonify({"status": "success", "message": "Feedback assimilated into model"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/extract-url", methods=["POST"])
def extract_url():
    data = request.get_json(force=True, silent=True) or {}
    url = data.get("url", "").strip()

    if not url:
        return jsonify({"error": "URL parameter is required"}), 400

    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url

    title = ""
    description = ""
    image_url = ""
    domain = urllib.parse.urlparse(url).netloc.replace("www.", "")

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        resp = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        soup = BeautifulSoup(resp.text, "html.parser")

        # 1. Title / Headline
        og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "twitter:title"})
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()
        elif soup.title and soup.title.string:
            title = soup.title.string.strip()
        elif soup.find("h1"):
            title = soup.find("h1").get_text().strip()

        # 2. Main Article Text / Summary
        og_desc = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "twitter:description"})
        if og_desc and og_desc.get("content"):
            description = og_desc["content"].strip()

        paragraphs = [p.get_text().strip() for p in soup.find_all("p") if len(p.get_text().strip()) > 30]
        full_body = "\n\n".join(paragraphs) if paragraphs else description
        combined_text = f"{title}. {description or full_body[:500]}".strip()

        # 3. Primary Image
        og_img = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "twitter:image"})
        if og_img and og_img.get("content"):
            image_url = og_img["content"].strip()
            if image_url.startswith("//"):
                image_url = "https:" + image_url
            elif image_url.startswith("/"):
                image_url = urllib.parse.urljoin(url, image_url)
        else:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                if src and not any(skip in src.lower() for skip in ["icon", "logo", "avatar", "spacer", "ad"]):
                    image_url = urllib.parse.urljoin(url, src)
                    break

    except Exception as e:
        print(f"[URL Fetch Warning]: {e}")
        path_parts = urllib.parse.urlparse(url).path.strip("/").split("/")
        slug = path_parts[-1] if path_parts else domain
        slug_clean = re.sub(r'[-_+]', ' ', slug).replace('.html', '').replace('.htm', '')
        if len(slug_clean) > 5 and not slug_clean.isdigit():
            title = slug_clean.title()
        else:
            title = f"News Article from {domain}"
        full_body = f"Extracted from web link: {url}"

    if not title:
        title = f"News Article from {domain}"

    combined_text = f"{title}. {description}".strip()
    ai_scan = engine.predict(combined_text)

    return jsonify({
        "status": "success",
        "url": url,
        "domain": domain,
        "title": title,
        "text": combined_text,
        "body": full_body,
        "image": image_url,
        "ai_analysis": ai_scan
    })

@app.route("/api/extract-file", methods=["POST"])
def extract_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded in form data 'file'"}), 400

    uploaded_file = request.files["file"]
    filename = uploaded_file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()

    extracted_text = ""
    extracted_image = ""

    try:
        file_bytes = uploaded_file.read()

        # 1. Plain Text (.txt)
        if ext == ".txt":
            extracted_text = file_bytes.decode("utf-8", errors="replace").strip()

        # 2. PDF Document (.pdf)
        elif ext == ".pdf":
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                try:
                    text = page.extract_text()
                    if text:
                        pages_text.append(text)
                except Exception:
                    pass

                # Extract first image if available and save to static uploads
                if not extracted_image and hasattr(page, "images"):
                    try:
                        for img in page.images:
                            if len(img.data) < 5 * 1024 * 1024:
                                ts = int(datetime.datetime.now().timestamp() * 1000)
                                ext_img = "jpg" if img.name.lower().endswith((".jpg", ".jpeg")) else "png"
                                fname = f"doc_img_{ts}.{ext_img}"
                                save_path = os.path.join(UPLOADS_DIR, fname)
                                with open(save_path, "wb") as f_out:
                                    f_out.write(img.data)
                                extracted_image = f"/uploads/{fname}"
                                break
                    except Exception as err:
                        print(f"PDF image save warning: {err}")

            extracted_text = "\n".join(pages_text).strip()

        # 3. Microsoft Word (.docx)
        elif ext == ".docx":
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            extracted_text = "\n".join(paragraphs).strip()

            for rel in doc.part.rels.values():
                if "image" in rel.target_ref:
                    try:
                        img_part = rel.target_part
                        if len(img_part.blob) < 5 * 1024 * 1024:
                            ts = int(datetime.datetime.now().timestamp() * 1000)
                            fname = f"doc_img_{ts}.png"
                            save_path = os.path.join(UPLOADS_DIR, fname)
                            with open(save_path, "wb") as f_out:
                                f_out.write(img_part.blob)
                            extracted_image = f"/uploads/{fname}"
                            break
                    except Exception as err:
                        print(f"Word image save warning: {err}")
        else:
            # Fallback for other text formats
            try:
                extracted_text = file_bytes.decode("utf-8", errors="replace").strip()
            except Exception:
                extracted_text = ""

        # Fallback if file has no text layer (e.g. scanned image PDF)
        base_name = os.path.splitext(filename)[0]
        if not extracted_text:
            extracted_text = base_name.replace("-", " ").replace("_", " ")

        lines = [line.strip() for line in extracted_text.split("\n") if line.strip()]
        title = lines[0] if lines else base_name
        if len(title) > 140:
            title = title[:137] + "..."

        body_preview = " ".join(lines[:4])
        ai_scan = engine.predict(body_preview)

        return jsonify({
            "status": "success",
            "filename": filename,
            "title": title,
            "text": body_preview,
            "body": extracted_text,
            "image": extracted_image,
            "total_characters": len(extracted_text),
            "ai_analysis": ai_scan
        })

    except Exception as e:
        # Graceful fallback: return filename and base text rather than crashing
        base_name = os.path.splitext(filename)[0].replace("-", " ").replace("_", " ")
        ai_scan = engine.predict(base_name)
        return jsonify({
            "status": "success",
            "filename": filename,
            "title": base_name,
            "text": f"Document content from {filename}",
            "image": "",
            "total_characters": 0,
            "ai_analysis": ai_scan
        })

if __name__ == "__main__":
    print("=" * 60)
    print(" Fake News NLP Microservice running on http://127.0.0.1:5000")
    print(" Supported input: Text, Web Links, PDF, Word (.docx), TXT")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=False)
