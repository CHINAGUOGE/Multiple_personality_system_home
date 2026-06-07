-- MPS Lab 赛车 D1 产品分析 SQL
--
-- 表：user_logs
-- 主要事件：lab_race_finish
-- 反应时间字段在 payload JSON 里：
--   $.reactionTime         玩家起步反应时间，单位：秒
--   $.opponentReactionTime 对手起步反应时间，单位：秒
--
-- 使用建议：
--   D1 里的 created_at 是 UTC 时间。下面统一用 date(created_at, '+8 hours') 统计北京时间自然日。
--   在 Cloudflare D1 控制台里，建议一次复制一整段查询执行，不要整份文件一起跑。
--   如果用命令行，也可以这样快速查总量：
--   npx wrangler d1 execute mps-user-logs --remote --command "SELECT COUNT(*) FROM user_logs;"
--
-- 当前埋点只记录“比赛完成”和“前端 JS 错误”。
-- 还不能看页面访问、开始比赛但未完成、中途退出这些漏斗指标；这些要后续加新事件。

-- 1. 最近 100 条比赛完成日志，把 payload JSON 拆成可读字段。
-- 先跑这段，确认线上数据长什么样。
WITH race_finish AS (
  SELECT
    id,
    created_at,
    datetime(created_at, '+8 hours') AS created_at_cn,
    date(created_at, '+8 hours') AS day_cn,
    session_id,
    app_version,
    json_extract(payload, '$.version') AS payload_version,
    json_extract(payload, '$.difficulty') AS difficulty,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    CAST(json_extract(payload, '$.reactionTime') AS REAL) AS reaction_s,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.opponentReactionTime') AS REAL) AS opponent_reaction_s,
    ROUND(CAST(json_extract(payload, '$.opponentReactionTime') AS REAL) * 1000.0, 0) AS opponent_reaction_ms,
    CAST(json_extract(payload, '$.raceCount') AS INTEGER) AS race_count,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist,
    CAST(json_extract(payload, '$.money') AS INTEGER) AS money,
    CAST(json_extract(payload, '$.winStreak') AS INTEGER) AS win_streak
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
)
SELECT
  id,
  created_at_cn,
  session_id,
  difficulty,
  rank,
  reaction_ms,
  opponent_reaction_ms,
  race_count,
  is_practice,
  is_ai_assist,
  money,
  win_streak,
  app_version
FROM race_finish
ORDER BY id DESC
LIMIT 100;

-- 2. 最近 14 天“手动 + 正式赛”的反应时间总览。
-- 看用户反应时间时，优先跑这一段。
-- 重点看：
--   samples: 样本量
--   sessions: 会话数，不是永久用户数
--   avg_reaction_ms: 平均反应毫秒
--   best_reaction_ms: 最快反应毫秒
--   win_rate_percent: 胜率
WITH race_finish AS (
  SELECT
    created_at,
    session_id,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
)
SELECT
  COUNT(*) AS samples,
  COUNT(DISTINCT session_id) AS sessions,
  ROUND(AVG(reaction_ms), 1) AS avg_reaction_ms,
  MIN(reaction_ms) AS best_reaction_ms,
  MAX(reaction_ms) AS slowest_reaction_ms,
  ROUND(100.0 * SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_percent,
  ROUND(AVG(CASE WHEN rank = 1 THEN reaction_ms END), 1) AS winner_avg_reaction_ms,
  ROUND(AVG(CASE WHEN rank > 1 THEN reaction_ms END), 1) AS non_winner_avg_reaction_ms
FROM race_finish
WHERE julianday(created_at) >= julianday('now', '-14 days')
  AND is_practice = 0
  AND is_ai_assist = 0
  AND reaction_ms IS NOT NULL;

-- 3. 每天的手动正式赛反应时间分位数。
-- p50 是中位水平，p90/p95 是偏慢用户体验。
-- 如果 p90/p95 突然变高，通常说明操作手感变差、用户设备变了，或当天样本里慢玩家更多。
WITH race_finish AS (
  SELECT
    created_at,
    date(created_at, '+8 hours') AS day_cn,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
),
samples AS (
  SELECT day_cn, reaction_ms
  FROM race_finish
  WHERE julianday(created_at) >= julianday('now', '-30 days')
    AND is_practice = 0
    AND is_ai_assist = 0
    AND reaction_ms IS NOT NULL
),
ranked AS (
  SELECT
    day_cn,
    reaction_ms,
    ROW_NUMBER() OVER (PARTITION BY day_cn ORDER BY reaction_ms) AS rn,
    COUNT(*) OVER (PARTITION BY day_cn) AS n
  FROM samples
)
SELECT
  day_cn,
  COUNT(*) AS samples,
  ROUND(AVG(reaction_ms), 1) AS avg_ms,
  MIN(CASE WHEN rn >= n * 0.50 THEN reaction_ms END) AS p50_ms,
  MIN(CASE WHEN rn >= n * 0.90 THEN reaction_ms END) AS p90_ms,
  MIN(CASE WHEN rn >= n * 0.95 THEN reaction_ms END) AS p95_ms,
  MIN(reaction_ms) AS best_ms,
  MAX(reaction_ms) AS slowest_ms
FROM ranked
GROUP BY day_cn
ORDER BY day_cn DESC;

-- 4. 手动正式赛反应时间分桶。
-- <80ms 通常不像正常手动点击，更像自动起步脚本，可以用来区分自然用户和脚本用户。
WITH race_finish AS (
  SELECT
    created_at,
    session_id,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
),
bucketed AS (
  SELECT
    CASE
      WHEN reaction_ms < 80 THEN '00 <80ms 疑似自动起步'
      WHEN reaction_ms < 150 THEN '01 80-149ms 极快'
      WHEN reaction_ms < 250 THEN '02 150-249ms 完美'
      WHEN reaction_ms < 550 THEN '03 250-549ms 正常'
      WHEN reaction_ms < 1000 THEN '04 550-999ms 偏慢'
      ELSE '05 >=1000ms 很慢'
    END AS reaction_bucket,
    session_id,
    rank,
    reaction_ms
  FROM race_finish
  WHERE julianday(created_at) >= julianday('now', '-30 days')
    AND is_practice = 0
    AND is_ai_assist = 0
    AND reaction_ms IS NOT NULL
)
SELECT
  reaction_bucket,
  COUNT(*) AS races,
  COUNT(DISTINCT session_id) AS sessions,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS race_share_percent,
  ROUND(100.0 * SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_percent,
  ROUND(AVG(reaction_ms), 1) AS avg_ms
FROM bucketed
GROUP BY reaction_bucket
ORDER BY reaction_bucket;

-- 5. 找出反应异常快的会话。
-- 适合排查“自动起步脚本”对数据的影响。
-- under_80ms_count 越高，越可能不是纯手动操作。
WITH race_finish AS (
  SELECT
    created_at,
    datetime(created_at, '+8 hours') AS created_at_cn,
    session_id,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
)
SELECT
  session_id,
  COUNT(*) AS manual_formal_races,
  ROUND(AVG(reaction_ms), 1) AS avg_reaction_ms,
  MIN(reaction_ms) AS best_reaction_ms,
  MAX(reaction_ms) AS slowest_reaction_ms,
  SUM(CASE WHEN reaction_ms < 80 THEN 1 ELSE 0 END) AS under_80ms_count,
  SUM(CASE WHEN reaction_ms < 150 THEN 1 ELSE 0 END) AS under_150ms_count,
  ROUND(100.0 * SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_percent,
  MAX(created_at_cn) AS last_seen_cn
FROM race_finish
WHERE julianday(created_at) >= julianday('now', '-30 days')
  AND is_practice = 0
  AND is_ai_assist = 0
  AND reaction_ms IS NOT NULL
GROUP BY session_id
HAVING COUNT(*) >= 3
ORDER BY under_80ms_count DESC, avg_reaction_ms ASC
LIMIT 50;

-- 6. 按难度看胜率和反应时间。
-- 如果某个难度下用户反应已经很快，但胜率仍然很低，说明数值可能太难。
WITH race_finish AS (
  SELECT
    created_at,
    session_id,
    json_extract(payload, '$.difficulty') AS difficulty,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.raceCount') AS INTEGER) AS race_count,
    CAST(json_extract(payload, '$.money') AS INTEGER) AS money,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
)
SELECT
  difficulty,
  COUNT(*) AS races,
  COUNT(DISTINCT session_id) AS sessions,
  ROUND(AVG(reaction_ms), 1) AS avg_reaction_ms,
  ROUND(100.0 * SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_percent,
  ROUND(AVG(race_count), 1) AS avg_race_count,
  ROUND(AVG(money), 1) AS avg_money
FROM race_finish
WHERE julianday(created_at) >= julianday('now', '-30 days')
  AND is_practice = 0
  AND is_ai_assist = 0
GROUP BY difficulty
ORDER BY CASE difficulty
  WHEN 'easy' THEN 1
  WHEN 'normal' THEN 2
  WHEN 'hard' THEN 3
  WHEN 'expert' THEN 4
  WHEN 'nightmare' THEN 5
  ELSE 99
END;

-- 7. 看反应速度和比赛结果的关系。
-- 如果反应越快胜率越高，说明起步机制对胜负有影响；
-- 如果各分桶胜率差不多，说明胜负主要由车辆数值、难度或随机因素决定。
WITH race_finish AS (
  SELECT
    created_at,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
),
bucketed AS (
  SELECT
    CASE
      WHEN reaction_ms < 150 THEN '00 <150ms'
      WHEN reaction_ms < 250 THEN '01 150-249ms'
      WHEN reaction_ms < 550 THEN '02 250-549ms'
      WHEN reaction_ms < 1000 THEN '03 550-999ms'
      ELSE '04 >=1000ms'
    END AS reaction_bucket,
    rank,
    reaction_ms
  FROM race_finish
  WHERE julianday(created_at) >= julianday('now', '-30 days')
    AND is_practice = 0
    AND is_ai_assist = 0
    AND reaction_ms IS NOT NULL
)
SELECT
  reaction_bucket,
  COUNT(*) AS races,
  ROUND(AVG(rank), 2) AS avg_rank,
  ROUND(100.0 * SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_percent,
  ROUND(100.0 * SUM(CASE WHEN rank <= 3 THEN 1 ELSE 0 END) / COUNT(*), 1) AS top3_rate_percent
FROM bucketed
GROUP BY reaction_bucket
ORDER BY reaction_bucket;

-- 8. 按比赛场次阶段看压力。
-- 用来发现玩家从第几场开始明显变难、输钱或胜率下滑。
WITH race_finish AS (
  SELECT
    created_at,
    session_id,
    json_extract(payload, '$.difficulty') AS difficulty,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.raceCount') AS INTEGER) AS race_count,
    CAST(json_extract(payload, '$.money') AS INTEGER) AS money,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
),
banded AS (
  SELECT
    CASE
      WHEN race_count < 5 THEN '00 race 0-4'
      WHEN race_count < 12 THEN '01 race 5-11'
      WHEN race_count < 20 THEN '02 race 12-19'
      WHEN race_count < 35 THEN '03 race 20-34'
      ELSE '04 race 35+'
    END AS race_count_band,
    difficulty,
    session_id,
    rank,
    reaction_ms,
    money
  FROM race_finish
  WHERE julianday(created_at) >= julianday('now', '-30 days')
    AND is_practice = 0
    AND is_ai_assist = 0
)
SELECT
  race_count_band,
  difficulty,
  COUNT(*) AS races,
  COUNT(DISTINCT session_id) AS sessions,
  ROUND(AVG(reaction_ms), 1) AS avg_reaction_ms,
  ROUND(100.0 * SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_percent,
  ROUND(AVG(money), 1) AS avg_money_after_finish
FROM banded
GROUP BY race_count_band, difficulty
ORDER BY race_count_band, difficulty;

-- 9. 每天的模式占比：手动正式赛 / AI 托管 / 练习赛。
-- 用来看用户到底是在真实手动玩，还是更多依赖 AI 托管或练习。
WITH race_finish AS (
  SELECT
    created_at,
    date(created_at, '+8 hours') AS day_cn,
    session_id,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
)
SELECT
  day_cn,
  COUNT(*) AS finishes,
  COUNT(DISTINCT session_id) AS sessions,
  SUM(CASE WHEN is_practice = 0 AND is_ai_assist = 0 THEN 1 ELSE 0 END) AS manual_formal_finishes,
  SUM(CASE WHEN is_ai_assist = 1 THEN 1 ELSE 0 END) AS ai_assist_finishes,
  SUM(CASE WHEN is_practice = 1 THEN 1 ELSE 0 END) AS practice_finishes,
  ROUND(100.0 * SUM(CASE WHEN is_ai_assist = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS ai_assist_share_percent,
  ROUND(100.0 * SUM(CASE WHEN is_practice = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS practice_share_percent
FROM race_finish
WHERE julianday(created_at) >= julianday('now', '-30 days')
GROUP BY day_cn
ORDER BY day_cn DESC;

-- 10. 每天的会话参与度。
-- session_id 是本地 24 小时会话，不是永久用户 ID。
-- 重点看：
--   active_sessions: 当天活跃会话数
--   avg_finishes_per_session: 平均每个会话完成几场
--   sessions_with_3plus_finishes: 玩到 3 场以上的会话
--   sessions_with_10plus_finishes: 玩到 10 场以上的重度会话
WITH race_finish AS (
  SELECT
    created_at,
    date(created_at, '+8 hours') AS day_cn,
    session_id,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
),
session_day AS (
  SELECT
    day_cn,
    session_id,
    COUNT(*) AS finish_count,
    SUM(CASE WHEN is_practice = 0 AND is_ai_assist = 0 THEN 1 ELSE 0 END) AS manual_formal_count,
    SUM(CASE WHEN is_practice = 0 AND is_ai_assist = 0 AND rank = 1 THEN 1 ELSE 0 END) AS manual_formal_wins,
    MIN(CASE WHEN is_practice = 0 AND is_ai_assist = 0 THEN reaction_ms END) AS best_manual_reaction_ms
  FROM race_finish
  WHERE julianday(created_at) >= julianday('now', '-30 days')
  GROUP BY day_cn, session_id
)
SELECT
  day_cn,
  COUNT(*) AS active_sessions,
  SUM(finish_count) AS total_finishes,
  ROUND(AVG(finish_count), 1) AS avg_finishes_per_session,
  SUM(CASE WHEN finish_count >= 3 THEN 1 ELSE 0 END) AS sessions_with_3plus_finishes,
  SUM(CASE WHEN finish_count >= 10 THEN 1 ELSE 0 END) AS sessions_with_10plus_finishes,
  ROUND(AVG(best_manual_reaction_ms), 1) AS avg_session_best_manual_reaction_ms,
  ROUND(
    100.0 * SUM(manual_formal_wins) / NULLIF(SUM(manual_formal_count), 0),
    1
  ) AS manual_formal_win_rate_percent
FROM session_day
GROUP BY day_cn
ORDER BY day_cn DESC;

-- 11. 按版本看完成量、会话数、反应时间和胜率。
-- 如果发版后某个版本胜率或反应时间异常，就从这里开始排查。
WITH race_finish AS (
  SELECT
    created_at,
    COALESCE(app_version, json_extract(payload, '$.version'), 'unknown') AS version,
    session_id,
    CAST(json_extract(payload, '$.rank') AS INTEGER) AS rank,
    ROUND(CAST(json_extract(payload, '$.reactionTime') AS REAL) * 1000.0, 0) AS reaction_ms,
    CAST(json_extract(payload, '$.isPractice') AS INTEGER) AS is_practice,
    CAST(json_extract(payload, '$.isAiAssist') AS INTEGER) AS is_ai_assist
  FROM user_logs
  WHERE event_name = 'lab_race_finish'
    AND source = 'race'
    AND json_valid(payload)
)
SELECT
  version,
  COUNT(*) AS finishes,
  COUNT(DISTINCT session_id) AS sessions,
  ROUND(AVG(CASE WHEN is_practice = 0 AND is_ai_assist = 0 THEN reaction_ms END), 1) AS manual_avg_reaction_ms,
  ROUND(
    100.0 * SUM(CASE WHEN is_practice = 0 AND is_ai_assist = 0 AND rank = 1 THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN is_practice = 0 AND is_ai_assist = 0 THEN 1 ELSE 0 END), 0),
    1
  ) AS manual_win_rate_percent
FROM race_finish
WHERE julianday(created_at) >= julianday('now', '-30 days')
GROUP BY version
ORDER BY finishes DESC;

-- 12. 最近 30 天前端错误。
-- 看错误信息、文件、行列号和命中次数，优先修命中次数高、影响会话多的问题。
WITH error_logs AS (
  SELECT
    id,
    created_at,
    datetime(created_at, '+8 hours') AS created_at_cn,
    date(created_at, '+8 hours') AS day_cn,
    session_id,
    app_version,
    json_extract(payload, '$.message') AS message,
    json_extract(payload, '$.file') AS file,
    CAST(json_extract(payload, '$.line') AS INTEGER) AS line,
    CAST(json_extract(payload, '$.column') AS INTEGER) AS column
  FROM user_logs
  WHERE event_name = 'lab_error'
    AND source = 'race'
    AND json_valid(payload)
)
SELECT
  day_cn,
  message,
  file,
  line,
  column,
  COUNT(*) AS hits,
  COUNT(DISTINCT session_id) AS sessions,
  MAX(created_at_cn) AS latest_seen_cn,
  GROUP_CONCAT(DISTINCT app_version) AS versions
FROM error_logs
WHERE julianday(created_at) >= julianday('now', '-30 days')
GROUP BY day_cn, message, file, line, column
ORDER BY day_cn DESC, hits DESC
LIMIT 100;
