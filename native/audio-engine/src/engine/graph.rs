//! Audio processing graph.
//!
//! Nodes are stored in topological order; `process_block` visits them in that
//! order. All intermediate buffers are pre-allocated at startup.
//!
#![allow(dead_code)]
//! This module provides the scaffolding; individual plugins or signal sources
//! implement [`AudioNode`].

// ─────────────────────────────────────────────────────────────────────────────
// AudioNode trait
// ─────────────────────────────────────────────────────────────────────────────

#[allow(dead_code)]
/// A node in the audio processing graph.
///
/// Implementors must be `Send` because the graph is processed on the audio
/// thread, which is different from the thread that owns the graph object.
pub trait AudioNode: Send {
    /// Process audio.
    ///
    /// * `inputs`  — zero or more input bus slices (mono, interleaved or stereo
    ///               depending on the node's input count).
    /// * `output`  — the node's single output bus (stereo interleaved).
    /// * `frames`  — number of stereo frames in this block.
    /// * `sample_rate` — current sample rate in Hz.
    fn process(
        &mut self,
        inputs: &[&[f32]],
        output: &mut [f32],
        frames: usize,
        sample_rate: u32,
    );

    /// Reported processing latency in frames (e.g. from look-ahead limiters).
    fn latency_frames(&self) -> u32 {
        0
    }

    /// Stable, unique identifier matching the track/plugin ID.
    fn node_id(&self) -> &str;
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioGraph
// ─────────────────────────────────────────────────────────────────────────────

#[allow(dead_code)]
/// The audio processing graph.
///
/// Nodes are kept in topological (dependency) order.
/// Intermediate buffers are pre-allocated to `max_frames * 2` floats
/// (stereo interleaved) per node slot.
pub struct AudioGraph {
    /// Processing nodes in topological order.
    nodes: Vec<Box<dyn AudioNode>>,
    /// One pre-allocated stereo output buffer per node.
    node_buffers: Vec<Vec<f32>>,
    /// Maximum frames per block (determines buffer allocation).
    max_frames: usize,
    /// Current audio sample rate.
    sample_rate: u32,
}

impl AudioGraph {
    /// Create an empty graph.
    ///
    /// `max_frames` sets the allocation size for intermediate buffers.
    pub fn new(max_frames: usize, sample_rate: u32) -> Self {
        Self {
            nodes: Vec::new(),
            node_buffers: Vec::new(),
            max_frames,
            sample_rate,
        }
    }

    /// Append a node to the end of the processing chain.
    ///
    /// Nodes should be added in topological order (sources first, sinks last).
    pub fn add_node(&mut self, node: Box<dyn AudioNode>) {
        // Allocate a stereo output buffer for this node.
        self.node_buffers.push(vec![0.0_f32; self.max_frames * 2]);
        self.nodes.push(node);
    }

    /// Remove a node by its ID. Returns `true` if found and removed.
    pub fn remove_node(&mut self, id: &str) -> bool {
        if let Some(pos) = self.nodes.iter().position(|n| n.node_id() == id) {
            self.nodes.remove(pos);
            self.node_buffers.remove(pos);
            true
        } else {
            false
        }
    }

    /// Find the index of a node by ID.
    pub fn find_node(&self, id: &str) -> Option<usize> {
        self.nodes.iter().position(|n| n.node_id() == id)
    }

    /// Return the total accumulated latency across all nodes (sum).
    pub fn total_latency_frames(&self) -> u32 {
        self.nodes.iter().map(|n| n.latency_frames()).sum()
    }

    /// Update the sample rate (e.g. after driver reinitialisation).
    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
    }

    /// Resize all internal buffers to a new maximum frame count.
    pub fn set_max_frames(&mut self, max_frames: usize) {
        self.max_frames = max_frames;
        for buf in &mut self.node_buffers {
            buf.resize(max_frames * 2, 0.0);
        }
    }

    /// Process one block through all nodes in order.
    ///
    /// Each node receives the outputs of *all previous nodes* as its inputs
    /// (simple linear chain model — for a proper DAG, build an edge list and
    /// route buffers accordingly).
    ///
    /// `output` is the final stereo interleaved output (2 × frames floats).
    pub fn process_block(&mut self, output: &mut [f32], frames: usize) {
        let sample_rate = self.sample_rate;

        for i in 0..self.nodes.len() {
            // Collect input references: all node outputs before index `i`.
            // Split the slice to satisfy the borrow checker.
            let (done_buffers, rest) = self.node_buffers.split_at_mut(i);
            let current_buf = &mut rest[0];

            // Zero the output buffer for this node.
            let len = frames * 2;
            current_buf[..len].fill(0.0);

            // Build input slice references.
            let input_refs: Vec<&[f32]> = done_buffers
                .iter()
                .map(|b| &b[..len])
                .collect();

            let out_slice = &mut current_buf[..len];

            self.nodes[i].process(&input_refs, out_slice, frames, sample_rate);
        }

        // Copy the last node's buffer to the final output.
        if let Some(last_buf) = self.node_buffers.last() {
            let len = frames * 2;
            output[..len].copy_from_slice(&last_buf[..len]);
        } else {
            // No nodes — silence.
            output[..frames * 2].fill(0.0);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PassthroughNode — minimal concrete node for testing
// ─────────────────────────────────────────────────────────────────────────────

/// A no-op node that copies its first input to its output unchanged.
///
/// Useful as a placeholder while real plugin nodes are not yet implemented.
#[allow(dead_code)]
pub struct PassthroughNode {
    id: String,
}

#[allow(dead_code)]
impl PassthroughNode {
    pub fn new(id: impl Into<String>) -> Self {
        Self { id: id.into() }
    }
}

impl AudioNode for PassthroughNode {
    fn process(
        &mut self,
        inputs: &[&[f32]],
        output: &mut [f32],
        frames: usize,
        _sample_rate: u32,
    ) {
        let len = frames * 2;
        if let Some(first) = inputs.first() {
            let copy_len = len.min(first.len());
            output[..copy_len].copy_from_slice(&first[..copy_len]);
        } else {
            output[..len].fill(0.0);
        }
    }

    fn node_id(&self) -> &str {
        &self.id
    }
}
