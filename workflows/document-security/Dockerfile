FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends clamav clamav-freshclam ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY scanner.py main.py ./
RUN chown -R clamav:clamav /app /var/lib/clamav /var/log/clamav
USER clamav
CMD ["python", "main.py"]
