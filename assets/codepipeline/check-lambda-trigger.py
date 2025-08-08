import argparse
import time

def main():
    parser = argparse.ArgumentParser(description="Decide trigger source based on timestamp.")
    parser.add_argument("--lambda-trigger-timestamp", type=float, required=True,
                        help="Timestamp from Lambda trigger (float seconds)")
    parser.add_argument("--diff-seconds", type=float, default=120,
                        help="Allowed time difference in seconds (default: 120)")
    args = parser.parse_args()

    current_ts = time.time()
    diff_seconds = current_ts - args.lambda_trigger_timestamp

    if 0 <= diff_seconds <= args.diff_seconds:
        trigger = "lambda"
    else:
        trigger = "github"

    print(trigger)

if __name__ == "__main__":
    main()
