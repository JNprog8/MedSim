FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
COPY backend ./backend/
COPY static ./static/
COPY frontend ./frontend/
COPY patients ./patients/
COPY students ./students/
COPY evaluations ./evaluations/
COPY encounters ./encounters/
COPY audio ./audio/
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

EXPOSE 8080

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]

