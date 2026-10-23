from typing import Protocol
from app.models.schemas import Observation


class AnomalyDetector(Protocol):
    def score(self, observations: list[Observation]) -> list[float]:
        """Return anomaly scores for comparable aggregate observations."""
        ...
