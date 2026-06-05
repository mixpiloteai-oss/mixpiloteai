//! Audio buffer memory pool.
#![allow(dead_code)]
//!
//! Pre-allocates a fixed set of stereo f32 buffers at startup so that the
//! real-time audio path can borrow buffers without touching the allocator.
//!
//! # Design
//!
//! Buffers are stored in a fixed-size array (stack-allocated metadata, heap
//! data). [`AudioBufferPool::acquire`] pops from an index stack and
//! [`AudioBufferPool::release`] pushes the index back. Both operations are
//! O(1) and do not allocate. A [`PooledBuffer`] RAII guard returns the buffer
//! automatically when dropped — but dropping inside the audio callback is safe
//! only if the release path is lock-free. Here we use a simple `Mutex`-free
//! fixed-size free-list backed by `crossbeam_channel`.

use crossbeam_channel::{bounded, Receiver, Sender};

// ─────────────────────────────────────────────────────────────────────────────
// PooledBuffer
// ─────────────────────────────────────────────────────────────────────────────

/// A borrowed buffer from the pool.
///
/// Call [`AudioBufferPool::release`] explicitly to return it, or let the
/// auto-release channel handle it — but prefer explicit release in real-time
/// contexts.
pub struct PooledBuffer {
    /// The stereo interleaved audio data.
    pub data: Vec<f32>,
    /// Channel used to return the buffer to the pool.
    return_tx: Sender<Vec<f32>>,
}

impl PooledBuffer {
    /// Zero the buffer up to `frames` stereo frames.
    #[inline]
    pub fn clear(&mut self, frames: usize) {
        let len = (frames * 2).min(self.data.len());
        self.data[..len].fill(0.0);
    }

    /// Return a mutable slice for `frames` stereo frames.
    #[inline]
    pub fn as_mut_slice(&mut self, frames: usize) -> &mut [f32] {
        let len = (frames * 2).min(self.data.len());
        &mut self.data[..len]
    }

    /// Return an immutable slice for `frames` stereo frames.
    #[inline]
    pub fn as_slice(&self, frames: usize) -> &[f32] {
        let len = (frames * 2).min(self.data.len());
        &self.data[..len]
    }

    /// Explicitly return this buffer to the pool.
    ///
    /// After calling this the buffer should not be used again.
    /// This simply drops `self`; the `Drop` impl handles the return.
    pub fn release(self) {
        // Drop triggers the Drop impl which sends data back via the channel.
        drop(self);
    }
}

impl Drop for PooledBuffer {
    fn drop(&mut self) {
        // Best-effort return: if the channel is full or closed, the Vec is
        // dropped (its allocator call happens here, not in the callback, if
        // the caller releases before returning from `process_block`).
        let data = std::mem::take(&mut self.data);
        let _ = self.return_tx.try_send(data);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioBufferPool
// ─────────────────────────────────────────────────────────────────────────────

/// A fixed-capacity pool of pre-allocated stereo f32 audio buffers.
pub struct AudioBufferPool {
    /// Channel acting as the free-list.
    free_tx: Sender<Vec<f32>>,
    free_rx: Receiver<Vec<f32>>,
    /// Channel endpoint used by [`PooledBuffer`] to return data.
    return_tx: Sender<Vec<f32>>,
}

impl AudioBufferPool {
    /// Create a pool with `count` buffers, each holding `max_frames` stereo frames.
    pub fn new(count: usize, max_frames: usize) -> Self {
        let capacity = count + 1; // +1 for the return path
        let (free_tx, free_rx) = bounded(capacity);
        let (return_tx, return_rx) = bounded(capacity);

        // Pre-fill the free list.
        for _ in 0..count {
            free_tx
                .try_send(vec![0.0_f32; max_frames * 2])
                .expect("pool channel overflow during init");
        }

        // Spawn a thread that drains the return channel back into the free list.
        // This avoids blocking the audio thread on pool maintenance.
        let free_tx_clone = free_tx.clone();
        std::thread::Builder::new()
            .name("pool-recycler".to_string())
            .spawn(move || {
                for buf in return_rx {
                    // If the free list is full (shouldn't happen in normal use),
                    // just drop the buffer.
                    let _ = free_tx_clone.try_send(buf);
                }
            })
            .expect("failed to spawn pool recycler thread");

        Self { free_tx, free_rx, return_tx }
    }

    /// Acquire a buffer from the pool.
    ///
    /// Returns `None` if all buffers are in use (pool exhausted).
    pub fn acquire(&self) -> Option<PooledBuffer> {
        self.free_rx.try_recv().ok().map(|data| PooledBuffer {
            data,
            return_tx: self.return_tx.clone(),
        })
    }

    /// Number of currently available buffers.
    pub fn available(&self) -> usize {
        self.free_rx.len()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_and_release() {
        let pool = AudioBufferPool::new(4, 512);
        assert_eq!(pool.available(), 4);

        let buf = pool.acquire().expect("pool should have buffers");
        assert_eq!(pool.available(), 3);

        buf.release();
        // Give the recycler thread a moment to process.
        std::thread::sleep(std::time::Duration::from_millis(10));
        assert_eq!(pool.available(), 4);
    }

    #[test]
    fn pool_exhaustion() {
        let pool = AudioBufferPool::new(2, 256);
        let b1 = pool.acquire().unwrap();
        let b2 = pool.acquire().unwrap();
        assert!(pool.acquire().is_none());
        drop(b1);
        drop(b2);
    }
}
