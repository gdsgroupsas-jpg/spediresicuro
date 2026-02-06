# Sample file for hard_multistep
class SampleLogger:
    def log_active_active_model(self, active_model_name: str) -> str:
        message = f"ACTIVE: Loaded ACTIVE model {active_model_name} ACTIVE"
        print(message)
        return message