from abc import ABC, abstractmethod
from typing import List, Optional
from ..schemas import StateMachineCreate, StateMachineResponse, AnalysisResponse

class StateMachineRepository(ABC):
    @abstractmethod
    def list(self, is_sample: Optional[bool] = None) -> List[StateMachineResponse]:
        pass

    @abstractmethod
    def get(self, id: str) -> Optional[StateMachineResponse]:
        pass

    @abstractmethod
    def create(self, data: StateMachineCreate) -> StateMachineResponse:
        pass

    @abstractmethod
    def update(self, id: str, data: StateMachineCreate) -> StateMachineResponse:
        pass

    @abstractmethod
    def delete(self, id: str) -> bool:
        pass

    @abstractmethod
    def get_analysis(self, id: str) -> AnalysisResponse:
        pass

    @abstractmethod
    def save_simulation_history(self, id: str, history_data: dict) -> None:
        pass

    @abstractmethod
    def get_simulation_history(self, id: str) -> List[dict]:
        pass
