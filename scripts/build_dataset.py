#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模組名稱：build_dataset.py
模組職責：讀取考選部驗光人員歷屆試題原始 CSV 檔案，進行資料清洗、答案正規化與結構化索引建立，
         並輸出可供前端非同步載入的靜態 JSON 題庫與場次詮釋資料。
"""

import csv
import json
import os
import re
from typing import Any, Dict, List, Tuple


# 預設原始 CSV 檔名對應設定常數
DEFAULT_CSV_FILES: Dict[str, str] = {
    "overview": "驗光國考歷屆試題彙整_場次總覽.csv",
    "optometrist": "驗光國考歷屆試題彙整_驗光師題庫.csv",
    "assistant": "驗光國考歷屆試題彙整_驗光生題庫.csv",
}

# 類別代碼與中文名稱對照常數
CATEGORY_MAP: Dict[str, Dict[str, str]] = {
    "optometrist": {"label": "驗光師", "output_file": "optometrist.json"},
    "assistant": {"label": "驗光生", "output_file": "assistant.json"},
}


def normalize_text(raw_value: Any) -> str:
    """
    將欄位原始值正規化為乾淨的字串，移除前後空白與不可見零寬字元。

    參數：
        raw_value (Any): CSV 讀取之原始欄位值。

    回傳：
        str: 清理後的字串，若原值為 None 則回傳空字串。
    """
    # 若為空值則直接回傳空字串
    if raw_value is None:
        return ""
    # 轉換為字串並移除零寬空白字元與頭尾空白
    cleaned_text: str = str(raw_value).replace("\u200b", "").strip()
    return cleaned_text


def parse_answer_list(raw_answer: str) -> List[str]:
    """
    將考選部答案字串解析為標準化正解陣列。
    支援單選（如 "C"）、複數正解（如 "A/D"、"A/B/C"）與「一律給分」（轉為 ["ALL"]）。

    參數：
        raw_answer (str): 原始答案欄位字串。

    回傳：
        List[str]: 標準化後之正解代碼陣列。
    """
    # 清理答案字串並轉大寫
    normalized_ans: str = normalize_text(raw_answer).upper()
    # 判斷是否為考選部公告一律給分題
    if "一律給分" in normalized_ans:
        return ["ALL"]
    # 依斜線或空白切分多重正解選項並過濾有效選項 A-D
    tokens: List[str] = [
        token.strip()
        for token in re.split(r"[/,、\s]+", normalized_ans)
        if token.strip() in {"A", "B", "C", "D"}
    ]
    return tokens if tokens else [normalized_ans]


def detect_has_image(note_text: str) -> bool:
    """
    根據備註欄文字判斷該題是否包含無法文字解析之圖形。

    參數：
        note_text (str): 題目備註文字。

    回傳：
        bool: 若包含「含圖」字樣回傳 True，否則回傳 False。
    """
    # 檢查備註中是否標記含圖
    has_image_flag: bool = "含圖" in note_text
    return has_image_flag


def build_session_lookup(overview_path: str) -> Tuple[List[Dict[str, Any]], Dict[Tuple[str, int, str, str], str]]:
    """
    讀取場次總覽 CSV，建立前端檢索用場次清單與場次代碼查詢表。

    參數：
        overview_path (str): 場次總覽 CSV 檔案路徑。

    回傳：
        Tuple[List[Dict[str, Any]], Dict[Tuple[str, int, str, str], str]]:
            - 第一元素：標準化場次總覽物件陣列。
            - 第二元素：以 (類別, 年度, 考試場次名稱, 科目) 為鍵、場次代碼為值的查詢字典。
    """
    # 存放所有場次科目紀錄的陣列
    sessions_list: List[Dict[str, Any]] = []
    # 供題庫對應場次代碼的快速查詢表
    code_lookup: Dict[Tuple[str, int, str, str], str] = {}

    with open(overview_path, mode="r", encoding="utf-8-sig", newline="") as csv_file:
        # 使用 DictReader 逐列讀取場次總覽
        reader = csv.DictReader(csv_file)
        for row in reader:
            category_label: str = normalize_text(row.get("類別"))
            year_roc: int = int(normalize_text(row.get("年度(民國)")))
            session_name: str = normalize_text(row.get("考試場次名稱"))
            exam_group: str = normalize_text(row.get("類科"))
            subject: str = normalize_text(row.get("科目"))
            question_count: int = int(normalize_text(row.get("題數") or "0"))
            image_count: int = int(normalize_text(row.get("含圖題數") or "0"))
            has_correction: bool = normalize_text(row.get("有無更正答案")) == "有"
            correction_note: str = normalize_text(row.get("更正內容(考選部備註)"))
            question_pdf: str = normalize_text(row.get("試題PDF"))
            answer_pdf: str = normalize_text(row.get("標準答案PDF"))
            corrected_pdf: str = normalize_text(row.get("更正答案PDF"))
            session_code: str = normalize_text(row.get("場次代碼"))

            # 組合標準化場次物件
            session_item: Dict[str, Any] = {
                "categoryKey": "optometrist" if category_label == "驗光師" else "assistant",
                "categoryLabel": category_label,
                "year": year_roc,
                "sessionCode": session_code,
                "sessionName": session_name,
                "examGroup": exam_group,
                "subject": subject,
                "questionCount": question_count,
                "imageCount": image_count,
                "hasCorrection": has_correction,
                "correctionNote": correction_note,
                "questionPdf": question_pdf,
                "answerPdf": answer_pdf,
                "correctedPdf": corrected_pdf,
            }
            sessions_list.append(session_item)
            code_lookup[(category_label, year_roc, session_name, subject)] = session_code

    return sessions_list, code_lookup


def convert_question_bank(
    csv_path: str,
    category_key: str,
    code_lookup: Dict[Tuple[str, int, str, str], str],
) -> List[Dict[str, Any]]:
    """
    讀取單一類別題庫 CSV 並轉換為前端專用標準化題目陣列。

    參數：
        csv_path (str): 題庫 CSV 檔案路徑。
        category_key (str): 類別代碼（"optometrist" 或 "assistant"）。
        code_lookup (Dict[Tuple[str, int, str, str], str]): 場次代碼查詢字典。

    回傳：
        List[Dict[str, Any]]: 標準化題目物件陣列。
    """
    # 存放解析後的題目物件陣列
    questions: List[Dict[str, Any]] = []

    with open(csv_path, mode="r", encoding="utf-8-sig", newline="") as csv_file:
        # 逐列解析題目資料
        reader = csv.DictReader(csv_file)
        for index, row in enumerate(reader, start=1):
            category_label: str = normalize_text(row.get("類別"))
            year_roc: int = int(normalize_text(row.get("年度(民國)")))
            session_name: str = normalize_text(row.get("考試場次名稱"))
            subject: str = normalize_text(row.get("科目"))
            number: int = int(normalize_text(row.get("題號")))
            stem: str = normalize_text(row.get("題目"))
            opt_a: str = normalize_text(row.get("選項A"))
            opt_b: str = normalize_text(row.get("選項B"))
            opt_c: str = normalize_text(row.get("選項C"))
            opt_d: str = normalize_text(row.get("選項D"))
            raw_answer: str = normalize_text(row.get("答案"))
            note: str = normalize_text(row.get("備註"))
            pdf_url: str = normalize_text(row.get("原卷PDF連結"))

            # 查找對應場次代碼，若查無則以年度與序號作為後備
            session_code: str = code_lookup.get(
                (category_label, year_roc, session_name, subject),
                f"{year_roc}000",
            )
            # 產生全域唯一題目識別碼
            question_id: str = f"{category_key}_{session_code}_{subject}_{number:02d}_{index}"
            # 解析正規化答案陣列
            answers: List[str] = parse_answer_list(raw_answer)
            # 判斷是否為含圖題或有空選項（常見於純圖形選項）
            has_empty_option: bool = any(opt == "" for opt in (opt_a, opt_b, opt_c, opt_d))
            has_image: bool = detect_has_image(note) or has_empty_option

            # 組合標準化題目物件
            question_obj: Dict[str, Any] = {
                "id": question_id,
                "categoryKey": category_key,
                "categoryLabel": category_label,
                "year": year_roc,
                "sessionCode": session_code,
                "sessionName": session_name,
                "subject": subject,
                "number": number,
                "question": stem,
                "options": {
                    "A": opt_a,
                    "B": opt_b,
                    "C": opt_c,
                    "D": opt_d,
                },
                "answers": answers,
                "rawAnswer": raw_answer,
                "note": note,
                "hasImage": has_image,
                "pdfUrl": pdf_url,
            }
            questions.append(question_obj)

    return questions


def build_metadata(
    sessions_list: List[Dict[str, Any]],
    question_counts: Dict[str, int],
) -> Dict[str, Any]:
    """
    彙整場次總覽與題庫統計資訊，建立 metadata.json 結構。

    參數：
        sessions_list (List[Dict[str, Any]]): 標準化場次陣列。
        question_counts (Dict[str, int]): 各類別總題數統計。

    回傳：
        Dict[str, Any]: 完整的系統詮釋資料物件。
    """
    # 按類別彙整年度與科目清單
    categories_meta: Dict[str, Dict[str, Any]] = {}
    for cat_key, cat_info in CATEGORY_MAP.items():
        cat_sessions: List[Dict[str, Any]] = [
            item for item in sessions_list if item["categoryKey"] == cat_key
        ]
        years: List[int] = sorted({item["year"] for item in cat_sessions}, reverse=True)
        subjects: List[str] = sorted({item["subject"] for item in cat_sessions})
        categories_meta[cat_key] = {
            "key": cat_key,
            "label": cat_info["label"],
            "dataFile": f"data/{cat_info['output_file']}",
            "totalQuestions": question_counts.get(cat_key, 0),
            "years": years,
            "subjects": subjects,
        }

    # 組合最終 metadata 結構
    metadata_obj: Dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "source": "考選部考畢試題查詢平臺（民國 106–115 年驗光人員歷屆試題）",
        "totalQuestions": sum(question_counts.values()),
        "categories": categories_meta,
        "sessions": sessions_list,
    }
    return metadata_obj


def run_build(source_dir: str = ".", output_dir: str = "data") -> None:
    """
    執行完整資料建置流程：讀取 CSV、轉換題庫與場次資料並寫入 JSON 檔案。

    參數：
        source_dir (str): 原始 CSV 檔案所在目錄路徑。
        output_dir (str): 輸出 JSON 檔案之目標目錄路徑。

    回傳：
        None
    """
    # 確保輸出目錄存在
    os.makedirs(output_dir, exist_ok=True)

    # 步驟 1：解析場次總覽 CSV
    overview_path: str = os.path.join(source_dir, DEFAULT_CSV_FILES["overview"])
    sessions_list, code_lookup = build_session_lookup(overview_path)

    # 步驟 2：依序轉換驗光師與驗光生題庫
    question_counts: Dict[str, int] = {}
    for cat_key, cat_info in CATEGORY_MAP.items():
        csv_path: str = os.path.join(source_dir, DEFAULT_CSV_FILES[cat_key])
        questions: List[Dict[str, Any]] = convert_question_bank(
            csv_path=csv_path,
            category_key=cat_key,
            code_lookup=code_lookup,
        )
        question_counts[cat_key] = len(questions)

        # 輸出壓縮格式 JSON 以縮減 GitHub Pages 傳輸體積
        out_path: str = os.path.join(output_dir, cat_info["output_file"])
        with open(out_path, mode="w", encoding="utf-8") as json_file:
            json.dump(questions, json_file, ensure_ascii=False, separators=(",", ":"))
        print(f"[完成] {out_path}（共 {len(questions)} 題）")

    # 步驟 3：輸出 metadata.json
    metadata_obj: Dict[str, Any] = build_metadata(sessions_list, question_counts)
    meta_path: str = os.path.join(output_dir, "metadata.json")
    with open(meta_path, mode="w", encoding="utf-8") as meta_file:
        json.dump(metadata_obj, meta_file, ensure_ascii=False, indent=2)
    print(f"[完成] {meta_path}（共 {len(sessions_list)} 個場次科目）")


if __name__ == "__main__":
    # 以目前工作目錄為 CSV 來源，輸出至 data 目錄
    run_build(source_dir=".", output_dir="data")
