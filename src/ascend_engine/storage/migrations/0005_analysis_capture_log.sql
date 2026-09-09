ALTER TABLE screen_analysis_runs ADD COLUMN screenshot_captured INTEGER NOT NULL DEFAULT 0 CHECK(screenshot_captured IN (0,1));
PRAGMA user_version = 5;
