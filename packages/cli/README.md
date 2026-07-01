# @agent-notifier/cli

Command-line interface for Agent Notifier.

The CLI exposes stable JSON contracts for local agents and CI. Without a Worker
API URL it returns `local_config` results for local sender configuration and key
state only. With a configured Worker origin it uses `http_api` for live
setup/status and encrypted send flow. Commands never claim delivery, replies,
or approvals that a real recipient device has not reported.
