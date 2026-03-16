FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
COPY main.py ./main.py
COPY api.py ./api.py
COPY domain ./domain/
COPY services ./services/
COPY templates ./templates/
COPY static ./static/
COPY patients ./patients/

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
