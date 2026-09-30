# Offline tests for the pipeline: the demo trip, a throwaway cache, no network (RELAXJER_OFFLINE).
# Run: uv run --project pipeline python -m unittest discover -s pipeline/tests -t pipeline   (pnpm test:pipeline)
import os, tempfile
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['RELAXJER_TRIP'] = os.path.join(REPO, 'examples', 'demo-trip')
os.environ['RELAXJER_CACHE_DIR'] = tempfile.mkdtemp(prefix='relaxjer-pipeline-test-')
os.environ['RELAXJER_OFFLINE'] = '1'
os.environ['RELAXJER_TODAY'] = '2027-03-01'
