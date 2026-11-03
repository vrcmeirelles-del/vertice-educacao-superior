from render import Retry, TaskContext, Workflows
from scanner import scan_document, self_test

app = Workflows(default_retry=Retry(max_retries=0, wait_duration_ms=1000), default_timeout=300, default_plan="2c-4g")


@app.task(name="scan_document")
def scan(ctx: TaskContext, signed_url: str, expected_sha256: str):
    return scan_document(signed_url, expected_sha256)


@app.task(name="self_test")
def check(ctx: TaskContext):
    return self_test()


if __name__ == "__main__":
    app.start()
