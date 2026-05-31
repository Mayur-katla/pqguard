export function generateGithubActionYaml(threshold = 70, apiBaseUrl = "${{ vars.PRGUARD_API_URL }}") {
  return `name: PRGuard

on:
  pull_request:
    types: [opened, synchronize, reopened, edited]

jobs:
  hollow-score:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Analyze current pull request
        env:
          PRGUARD_API_URL: ${apiBaseUrl}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          REPO: \${{ github.repository }}
          PR_NUMBER: \${{ github.event.pull_request.number }}
          PR_TITLE: \${{ github.event.pull_request.title }}
          PR_BODY: \${{ github.event.pull_request.body }}
        run: |
          api="https://api.github.com/repos/$REPO/pulls/$PR_NUMBER"
          auth_header="Authorization: Bearer $GITHUB_TOKEN"

          files=$(curl -sS -H "$auth_header" -H "Accept: application/vnd.github+json" "$api/files?per_page=100")
          commits=$(curl -sS -H "$auth_header" -H "Accept: application/vnd.github+json" "$api/commits?per_page=100")
          comments=$(curl -sS -H "$auth_header" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$REPO/issues/$PR_NUMBER/comments?per_page=100")
          review_comments=$(curl -sS -H "$auth_header" -H "Accept: application/vnd.github+json" "$api/comments?per_page=100")

          payload=$(
            jq -n \\
              --arg mode "code_review" \\
              --arg title "$PR_TITLE" \\
              --arg text "\${PR_BODY:-No pull request description provided.}" \\
              --argjson files "$files" \\
              --argjson commits "$commits" \\
              --argjson comments "$comments" \\
              --argjson reviewComments "$review_comments" \\
              '{
                mode: $mode,
                title: $title,
                text: $text,
                files: ($files | map({ filename, additions, deletions, patch })),
                commits: ($commits | map({ sha, message: .commit.message, author: .commit.author.name, date: .commit.author.date })),
                comments: (($comments + $reviewComments) | map({ body, author: .user.login, path, date: .created_at }))
              }'
          )

          curl -sS -X POST "$PRGUARD_API_URL/api/proof/analyze" -H "Content-Type: application/json" -d "$payload" > prguard-result.json
          score=$(jq '.hollowScore.score' prguard-result.json)
          proof=$(jq '.proofScore' prguard-result.json)
          echo "PRGuard hollow score: $score"
          echo "PRGuard human proof score: $proof"
          if [ "$score" -ge ${threshold} ]; then
            echo "PRGuard blocked this PR because the hollow score is above ${threshold}."
            exit 1
          fi
`;
}
