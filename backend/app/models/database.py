from sqlalchemy import String, JSON, Index, create_engine, select, delete
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from app.models.schemas import Observation


class Base(DeclarativeBase):
    pass


class Snapshot(Base):
    __tablename__ = 'snapshots'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


class StoredObservation(Base):
    __tablename__ = 'observations'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data_source: Mapped[str] = mapped_column(String(32))
    dataset: Mapped[str] = mapped_column(String(32))
    timestamp: Mapped[str] = mapped_column(String(40))
    source_country: Mapped[str | None] = mapped_column(String(8))
    target_country: Mapped[str | None] = mapped_column(String(8))
    payload: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (
        Index('ix_source_dataset_time', 'data_source', 'dataset', 'timestamp'),
        Index('ix_source_country_time', 'source_country', 'timestamp'),
        Index('ix_target_country_time', 'target_country', 'timestamp'),
    )


class Database:
    def __init__(self, url):
        options = {'check_same_thread': False} if url.startswith('sqlite') else {}
        self.engine = create_engine(url, connect_args=options)
        self.session = sessionmaker(self.engine)
        Base.metadata.create_all(self.engine)

    def save(self, observations: list[Observation], snapshots=None):
        changed = 0
        with self.session.begin() as session:
            for key, payload in (snapshots or {}).items():
                snapshot = session.get(Snapshot, key)
                if snapshot is None:
                    session.add(Snapshot(id=key, payload=payload))
                else:
                    # A revised top-N set can remove a pair. Remove obsolete rows
                    # only for that exact measurement window, retaining history.
                    old_meta = snapshot.payload.get('meta', {})
                    new_meta = payload.get('meta', {})
                    if old_meta.get('dateRange') == new_meta.get('dateRange'):
                        obsolete = set(snapshot.payload['ids']) - set(payload['ids'])
                        if obsolete:
                            session.execute(delete(StoredObservation).where(StoredObservation.id.in_(obsolete)))
                    snapshot.payload = payload
            for obs in observations:
                payload = obs.model_dump(mode='json')
                row = session.get(StoredObservation, obs.id)
                if row is None:
                    session.add(StoredObservation(id=obs.id, data_source=obs.dataSource,
                        dataset=obs.dataset, timestamp=payload['timestamp'],
                        source_country=obs.sourceCountry, target_country=obs.targetCountry, payload=payload))
                    changed += 1
                else:
                    old = {k: v for k, v in row.payload.items() if k != 'collectedAt'}
                    new = {k: v for k, v in payload.items() if k != 'collectedAt'}
                    if old != new:
                        row.payload = payload
                        changed += 1
        return changed

    def snapshot(self, source, dataset):
        with self.session() as session:
            row = session.get(Snapshot, f'{source}:{dataset}')
            return row.payload if row else None

    def latest(self, source, dataset):
        snapshot = self.snapshot(source, dataset)
        if snapshot is None:
            return []
        with self.session() as session:
            statement = select(StoredObservation).where(StoredObservation.id.in_(snapshot['ids']))
            return [Observation.model_validate(row.payload) for row in session.scalars(statement)]

    def load(self, source, dataset=None):
        statement = select(StoredObservation).where(StoredObservation.data_source == source)
        if dataset:
            statement = statement.where(StoredObservation.dataset == dataset)
        with self.session() as session:
            return [Observation.model_validate(row.payload) for row in session.scalars(statement)]
