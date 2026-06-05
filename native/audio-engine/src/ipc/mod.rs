//! Inter-process communication module.
//!
//! Provides the JSON-over-stdin/stdout protocol used to exchange messages
//! between the Electron main process and the native audio engine.

pub mod protocol;

use std::sync::Arc;

use log::{debug, error, warn};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    sync::mpsc,
};

use protocol::{parse_command, Command, Event};

/// Run the async IPC loop.
///
/// Reads newline-delimited JSON commands from stdin and dispatches them to
/// `cmd_tx`. Listens for [`Event`]s on `event_rx` and writes them to stdout.
///
/// Returns when the loop detects stdin EOF or a `Shutdown` command is received.
pub async fn run_ipc_loop(
    cmd_tx: mpsc::Sender<Command>,
    mut event_rx: mpsc::Receiver<Event>,
    shutdown_tx: Arc<tokio::sync::Notify>,
) {
    // Spawn a task that writes events to stdout.
    let writer_handle = tokio::task::spawn_local(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(event) = event_rx.recv().await {
            let line = event.to_json_line();
            if let Err(e) = stdout.write_all(line.as_bytes()).await {
                error!("IPC write error: {}", e);
                break;
            }
            if let Err(e) = stdout.flush().await {
                error!("IPC flush error: {}", e);
                break;
            }
        }
    });

    // Read commands from stdin.
    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                // EOF — Electron process has closed the pipe.
                debug!("IPC stdin EOF — initiating shutdown");
                shutdown_tx.notify_one();
                break;
            }
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                debug!("IPC recv: {}", trimmed);
                match parse_command(trimmed) {
                    Ok(Command::Shutdown) => {
                        debug!("IPC received shutdown command");
                        // Forward the command so the engine can clean up.
                        let _ = cmd_tx.send(Command::Shutdown).await;
                        shutdown_tx.notify_one();
                        break;
                    }
                    Ok(cmd) => {
                        if cmd_tx.send(cmd).await.is_err() {
                            warn!("IPC command channel closed — stopping reader");
                            break;
                        }
                    }
                    Err(e) => {
                        warn!("IPC parse error: {} | line: {:?}", e, trimmed);
                    }
                }
            }
            Err(e) => {
                error!("IPC read error: {}", e);
                shutdown_tx.notify_one();
                break;
            }
        }
    }

    writer_handle.abort();
}
