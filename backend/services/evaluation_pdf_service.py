from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from backend.domain.models import Encounter, PatientProfile, SegueEvaluation, StudentProfile
from backend.domain.segue_catalog import SEGUE_SECTIONS


class EvaluationPdfService:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.title_style = ParagraphStyle(
            "SegueTitle",
            parent=self.styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=21,
            textColor=colors.HexColor("#00374B"),
            alignment=TA_CENTER,
            spaceAfter=10,
        )
        self.subtitle_style = ParagraphStyle(
            "SegueSubtitle",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#456072"),
            alignment=TA_CENTER,
            spaceAfter=12,
        )
        self.meta_style = ParagraphStyle(
            "SegueMeta",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#191C1E"),
        )
        self.area_style = ParagraphStyle(
            "SegueArea",
            parent=self.styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.white,
        )
        self.cell_style = ParagraphStyle(
            "SegueCell",
            parent=self.styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=10.5,
            textColor=colors.HexColor("#191C1E"),
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
            topMargin=1.0 * cm,
            bottomMargin=1.0 * cm,
        )

        story = [
            Paragraph("Marco SEGUE para evaluar habilidades de comunicacion", self.title_style),
            Paragraph(
                "Guia estructurada para acompañar la observacion de entrevistas clinicas en MedSim.",
                self.subtitle_style,
            ),
            self._build_meta_table(evaluation, encounter, patient, student),
            Spacer(1, 0.35 * cm),
            self._build_evaluation_table(evaluation),
        ]

        doc.build(story)
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
        evaluator_name = evaluation.evaluator_name or encounter.evaluator_name if encounter else evaluation.evaluator_name
        evaluator_name = evaluator_name or "-"

        data = [[
            Paragraph("<b>Estudiante</b><br/>" + self._safe(student_name), self.meta_style),
            Paragraph("<b>Matricula / DNI</b><br/>" + self._safe(student_identifier), self.meta_style),
            Paragraph("<b>Evaluador</b><br/>" + self._safe(evaluator_name), self.meta_style),
        ]]
        table = Table(data, colWidths=[6.4 * cm, 6.0 * cm, 6.0 * cm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4F8FB")),
                    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#BED0DB")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5E1E8")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        return table

    def _build_evaluation_table(self, evaluation: SegueEvaluation) -> Table:
        items_by_id = {str(item.id): item for item in evaluation.items}
        rows = [[
            Paragraph("<b>#</b>", self.cell_style),
            Paragraph("<b>Criterio</b>", self.cell_style),
            Paragraph("<b>Si</b>", self.cell_style),
            Paragraph("<b>No</b>", self.cell_style),
            Paragraph("<b>NC</b>", self.cell_style),
            Paragraph("<b>Observaciones</b>", self.cell_style),
        ]]

        running_number = 0
        for section in SEGUE_SECTIONS:
            rows.append(
                [
                    "",
                    Paragraph(self._safe(section["area"]), self.area_style),
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
                        Paragraph(str(running_number), self.cell_style),
                        Paragraph(self._safe(item["label"]), self.cell_style),
                        Paragraph("X" if value == "yes" else "", self.cell_style),
                        Paragraph("X" if value == "no" else "", self.cell_style),
                        Paragraph("X" if value == "nc" else "", self.cell_style),
                        Paragraph(self._safe(notes or " "), self.cell_style),
                    ]
                )

        table = Table(
            rows,
            repeatRows=1,
            colWidths=[0.8 * cm, 8.4 * cm, 1.2 * cm, 1.2 * cm, 1.2 * cm, 6.2 * cm],
        )

        styles = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#CFE9F2")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#00374B")),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 1), (4, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#BED0DB")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D5E1E8")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]

        row_index = 1
        area_color = colors.HexColor("#0B4F68")
        zebra = [colors.white, colors.HexColor("#F7FBFD")]
        zebra_index = 0
        for section in SEGUE_SECTIONS:
            styles.extend(
                [
                    ("SPAN", (1, row_index), (5, row_index)),
                    ("BACKGROUND", (0, row_index), (-1, row_index), area_color),
                    ("TEXTCOLOR", (0, row_index), (-1, row_index), colors.white),
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
