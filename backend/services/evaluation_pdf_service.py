from io import BytesIO
from typing import Optional
import time

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from backend.domain.models import Encounter, PatientProfile, SegueEvaluation, StudentProfile
from backend.domain.segue_catalog import SEGUE_SECTIONS, SEGUE_ITEMS


class EvaluationPdfService:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        
        # Typography & Styles matching MedSim brand colors
        self.title_style = ParagraphStyle(
            "SegueTitle",
            parent=self.styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#083344"),  # Deep Teal
            alignment=TA_CENTER,
            spaceAfter=4,
        )
        self.subtitle_style = ParagraphStyle(
            "SegueSubtitle",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#0891B2"),  # Cyan 600
            alignment=TA_CENTER,
            spaceAfter=15,
        )
        self.meta_title_style = ParagraphStyle(
            "SegueMetaTitle",
            parent=self.styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#64748B"),  # Slate 500
        )
        self.meta_val_style = ParagraphStyle(
            "SegueMetaVal",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#0F172A"),  # Slate 900
        )
        self.meta_score_style = ParagraphStyle(
            "SegueMetaScore",
            parent=self.styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#0E7490"),  # Cyan 700
        )
        self.area_style = ParagraphStyle(
            "SegueArea",
            parent=self.styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.white,
        )
        self.cell_hdr_style = ParagraphStyle(
            "SegueCellHdr",
            parent=self.styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            textColor=colors.white,
        )
        self.cell_style = ParagraphStyle(
            "SegueCell",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#334155"),  # Slate 700
        )
        self.cell_style_bold = ParagraphStyle(
            "SegueCellBold",
            parent=self.styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0F172A"),  # Slate 900
        )
        self.cell_check_style = ParagraphStyle(
            "SegueCellCheck",
            parent=self.styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#0E7490"),  # Cyan 700
            alignment=TA_CENTER,
        )

    def build_pdf(
        self,
        evaluation: SegueEvaluation,
        encounter: Optional[Encounter] = None,
        patient: Optional[PatientProfile] = None,
        student: Optional[StudentProfile] = None,
    ) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=1.2 * cm,
            rightMargin=1.2 * cm,
            topMargin=1.2 * cm,
            bottomMargin=1.5 * cm,
        )

        story = [
            Paragraph("Reporte de Evaluación de Competencias Clínicas", self.title_style),
            Paragraph(
                "Marco SEGUE • Registro estructurado de habilidades de comunicación en consulta médica",
                self.subtitle_style,
            ),
            self._build_meta_table(evaluation, encounter, patient, student),
            Spacer(1, 0.4 * cm),
            self._build_evaluation_table(evaluation),
        ]

        def add_footer(canvas, doc):
            page_num = canvas.getPageNumber()
            canvas.saveState()
            canvas.setFont('Helvetica-Bold', 7.5)
            canvas.setFillColor(colors.HexColor('#64748B'))
            canvas.drawString(1.2 * cm, 0.6 * cm, "MedSim")
            canvas.setFont('Helvetica', 7.5)
            canvas.drawString(2.3 * cm, 0.6 * cm, "• Evaluación de Habilidades de Comunicación (SEGUE)")
            canvas.drawRightString(21.0 * cm - 1.2 * cm, 0.6 * cm, f"Página {page_num}")
            canvas.restoreState()

        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        return buffer.getvalue()

    def _build_meta_table(
        self,
        evaluation: SegueEvaluation,
        encounter: Optional[Encounter],
        patient: Optional[PatientProfile],
        student: Optional[StudentProfile],
    ) -> Table:
        student_name = evaluation.student_name or (student.name if student else "-")
        student_identifier = evaluation.student_identifier or (student.student_identifier if student else "-")
        evaluator_name = evaluation.evaluator_name or (encounter.evaluator_name if encounter else evaluation.evaluator_name)
        evaluator_name = evaluator_name or "-"
        patient_name = patient.name if patient else (encounter.patient_id if encounter else "-")
        
        # Calculate score
        score_yes = sum(1 for item in evaluation.items if item.value == 'yes')
        score_no = sum(1 for item in evaluation.items if item.value == 'no')
        total_eval = score_yes + score_no
        total_items = len(SEGUE_ITEMS)
        percentage = int(score_yes / total_items * 100) if total_items > 0 else 0

        # Construct beautiful 4-column cards inside a structured table
        data = [
            [
                Paragraph("ESTUDIANTE", self.meta_title_style),
                Paragraph("EVALUADOR/A", self.meta_title_style),
                Paragraph("PACIENTE SIMULADO", self.meta_title_style),
                Paragraph("DESEMPEÑO SEGUE", self.meta_title_style),
            ],
            [
                Paragraph(f"<b>{self._safe(student_name)}</b><br/><font color='#64748B' size='7.5'>DNI: {self._safe(student_identifier)}</font>", self.meta_val_style),
                Paragraph(f"<b>{self._safe(evaluator_name)}</b><br/><font color='#64748B' size='7.5'>Docente Evaluador</font>", self.meta_val_style),
                Paragraph(f"<b>{self._safe(patient_name)}</b><br/><font color='#64748B' size='7.5'>Caso Clínico</font>", self.meta_val_style),
                Paragraph(f"{score_yes} / {total_items} cumplidos<br/><b>{percentage}% de efectividad</b>", self.meta_score_style),
            ]
        ]
        
        # Total printable width is 18.6 cm
        table = Table(data, colWidths=[5.0 * cm, 4.8 * cm, 4.8 * cm, 4.0 * cm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")), # Light Slate Background
                    ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")), # Border Slate 200
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, 0), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                    ("TOPPADDING", (0, 1), (-1, 1), 2),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
                ]
            )
        )
        return table

    def _build_evaluation_table(self, evaluation: SegueEvaluation) -> Table:
        items_by_id = {str(item.id): item for item in evaluation.items}
        
        # Headers styled elegantly
        rows = [[
            Paragraph("<b>#</b>", self.cell_hdr_style),
            Paragraph("<b>Criterio de Evaluación SEGUE</b>", self.cell_hdr_style),
            Paragraph("<b>SÍ</b>", self.cell_hdr_style),
            Paragraph("<b>NO</b>", self.cell_hdr_style),
            Paragraph("<b>N/C</b>", self.cell_hdr_style),
            Paragraph("<b>Observaciones / Notas de Retroalimentación</b>", self.cell_hdr_style),
        ]]

        running_number = 0
        for section in SEGUE_SECTIONS:
            # Full row spanning section banner
            rows.append(
                [
                    Paragraph(self._safe(section["area"]), self.area_style),
                    "",
                    "",
                    "",
                    "",
                    "",
                ]
            )
            for item in section["items"]:
                running_number += 1
                saved = items_by_id.get(item["id"])
                value = (saved.value if saved else "nc").lower()
                notes = saved.notes if saved else ""
                
                rows.append(
                    [
                        Paragraph(str(running_number), self.cell_style_bold),
                        Paragraph(self._safe(item["label"]), self.cell_style),
                        Paragraph("<b>✓</b>" if value == "yes" else "", self.cell_check_style),
                        Paragraph("<b>✗</b>" if value == "no" else "", self.cell_check_style),
                        Paragraph("<b>-</b>" if value == "nc" else "", self.cell_check_style),
                        Paragraph(self._safe(notes or " "), self.cell_style),
                    ]
                )

        # 18.6 cm total A4 printable width
        table = Table(
            rows,
            repeatRows=1,
            colWidths=[0.8 * cm, 8.8 * cm, 1.2 * cm, 1.2 * cm, 1.2 * cm, 5.4 * cm],
        )

        styles = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),  # Dark Slate 900 for Header
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (4, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),  # Border Slate 300
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E2E8F0")),  # Grid Slate 200
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]

        row_index = 1
        area_color = colors.HexColor("#0E7490")  # Cyan 700 for Section Banners
        zebra = [colors.white, colors.HexColor("#F8FAFC")]  # Alternate Slate 50
        zebra_index = 0
        
        for section in SEGUE_SECTIONS:
            # Span columns 0 to 5 for a clean full row banner!
            styles.extend(
                [
                    ("SPAN", (0, row_index), (5, row_index)),
                    ("BACKGROUND", (0, row_index), (-1, row_index), area_color),
                    ("TOPPADDING", (0, row_index), (-1, row_index), 6),
                    ("BOTTOMPADDING", (0, row_index), (-1, row_index), 6),
                ]
            )
            row_index += 1
            for _item in section["items"]:
                bg = zebra[zebra_index % 2]
                styles.append(("BACKGROUND", (0, row_index), (-1, row_index), bg))
                zebra_index += 1
                row_index += 1

        table.setStyle(TableStyle(styles))
        return table

    @staticmethod
    def _safe(value: str) -> str:
        return (
            str(value or "-")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
