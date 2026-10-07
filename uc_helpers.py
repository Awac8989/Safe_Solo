import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from generate_thesis_docx_helpers import (
    setup_page_layout, setup_styles, add_p, add_chapter_title,
    add_h2, add_h3, add_bullet, add_code_block, add_styled_table,
    add_figure
)

def add_use_case_table(doc, uc_id, uc_name, actor, pre_cond, post_cond, main_steps, alt_steps, exc_steps):
    add_h3(doc, f"Đặc tả Use Case {uc_id}: {uc_name}")
    headers = ["Thuộc tính Use Case", "Nội dung chi tiết"]
    main_flow_str = "\n".join([f"{i+1}. {step}" for i, step in enumerate(main_steps)])
    alt_flow_str = "\n".join([f"- {step}" for step in alt_steps]) if alt_steps else "Không có"
    exc_flow_str = "\n".join([f"- {step}" for step in exc_steps]) if exc_steps else "Không có"
    
    data = [
        ["Mã định danh", uc_id],
        ["Tên Use Case", uc_name],
        ["Tác nhân chính (Actor)", actor],
        ["Tiền điều kiện (Pre-conditions)", pre_cond],
        ["Hậu điều kiện (Post-conditions)", post_cond],
        ["Luồng sự kiện chính (Main Flow)", main_flow_str],
        ["Luồng nhánh thay thế (Alternative Flow)", alt_flow_str],
        ["Luồng ngoại lệ (Exception Flow)", exc_flow_str]
    ]
    add_styled_table(doc, headers, data, col_widths=[2.0, 4.6])

print("Use case table helper defined.")
