"use client";

import { Component, type ReactNode } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import type { Agent } from "@/lib/types";

type Props = {
  children: ReactNode;
  agents: Agent[];
  selectedId: string | null;
  onSelect: (agent: Agent) => void;
};

/** A bad asset or lost WebGL context must never take conversations with it. */
export class StudioBoundary extends Component<Props, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() { return { failed: true }; }

  retry = () => {
    // Clear rejected loader promises before remounting the canvas.
    useGLTF.clear("/models/studio/characters.glb");
    for (const name of ["chair", "executive-chair", "lounge", "plant", "mug", "espresso"]) {
      useGLTF.clear(`/models/studio/furniture-${name}.glb`);
    }
    for (const name of ["oak", "fabric", "plaster", "garden"]) useTexture.clear(`/textures/studio/${name}.jpg`);
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  render() {
    if (!this.state.failed) return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
    return <div className="absolute inset-0 grid place-items-center overflow-y-auto p-6">
      <div className="max-w-md rounded-2xl border border-line bg-inset p-6 text-center shadow-sm">
        <p role="alert" className="text-[15px] font-semibold text-ink">The studio could not be loaded.</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">Your conversations are still available. Select a teammate here or try opening the studio again.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {this.props.agents.map((agent) => <button key={agent.id} onClick={() => this.props.onSelect(agent)}
            aria-pressed={this.props.selectedId === agent.id}
            className="min-h-11 rounded-xl border border-line bg-surface px-4 text-[13px] text-ink aria-pressed:border-accent-line aria-pressed:bg-accent-soft">
            <span dir="auto">{agent.name}</span>
          </button>)}
        </div>
        <button onClick={this.retry} className="mt-5 min-h-11 rounded-xl bg-[#405b41] px-5 text-[13px] font-medium text-white hover:bg-[#304731] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#405b41]">Retry studio</button>
      </div>
    </div>;
  }
}
