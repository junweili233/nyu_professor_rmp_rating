import { describe, expect, it } from "vitest";
import {
  extractInstructorNamesFromText,
  normalizeInstructorName,
} from "../src/shared/albertParser.js";

describe("Albert instructor parsing", () => {
  it("normalizes Albert instructor labels into searchable names", () => {
    expect(normalizeInstructorName("Instructor:  Staff")).toBe("");
    expect(normalizeInstructorName("Prof. Ada Lovelace (Primary Instructor)")).toBe("Ada Lovelace");
    expect(normalizeInstructorName("GRACE B. HOPPER")).toBe("Grace B. Hopper");
    expect(normalizeInstructorName("PROF. MAEVE O'CONNOR")).toBe("Maeve O'Connor");
    expect(normalizeInstructorName("ROBERT MARTIN III")).toBe("Robert Martin III");
    expect(normalizeInstructorName("ROBERT MARTIN III.")).toBe("Robert Martin III");
    expect(normalizeInstructorName("ROBERT MARTIN JR.")).toBe("Robert Martin Jr.");
  });

  it("ignores Albert placeholder instructor names", () => {
    expect(normalizeInstructorName("Instructor: No Instructor Assigned")).toBe("");
    expect(normalizeInstructorName("No instructor assigned")).toBe("");
    expect(normalizeInstructorName("Instructor: TBD")).toBe("");
    expect(normalizeInstructorName("To Be Determined")).toBe("");
    expect(normalizeInstructorName("Unassigned")).toBe("");
    expect(normalizeInstructorName("Not Assigned")).toBe("");
    expect(normalizeInstructorName("Instructor: N/A")).toBe("");
    expect(normalizeInstructorName("None")).toBe("");
    expect(normalizeInstructorName("Department Staff")).toBe("");
    expect(normalizeInstructorName("Courant Staff")).toBe("");
    expect(extractInstructorNamesFromText("Instructor: No Instructor Assigned")).toEqual([]);
    expect(extractInstructorNamesFromText("Instructor: TBD")).toEqual([]);
    expect(extractInstructorNamesFromText("Instructor: To Be Determined")).toEqual([]);
    expect(extractInstructorNamesFromText("Instructor: Unassigned")).toEqual([]);
    expect(extractInstructorNamesFromText("Instructor: Not Assigned")).toEqual([]);
    expect(extractInstructorNamesFromText("Instructor: N/A")).toEqual([]);
    expect(extractInstructorNamesFromText("Instructor: None")).toEqual([]);
    expect(extractInstructorNamesFromText("Instructor: Department Staff")).toEqual([]);
  });

  it("extracts unique professor names from an Albert shopping-cart style block", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Lecture 001
      Instructor: Ada Lovelace
      Also listed as Department Consent Required
      Instructor(s): Grace B. Hopper, Alan Turing
      Instructor: Ada Lovelace
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Ada Lovelace",
      "Grace B. Hopper",
      "Alan Turing",
    ]);
  });

  it("understands Albert last-name-first instructor formatting", () => {
    const text = `
      CSCI-UA 102 Data Structures
      Instructor: YAP, CHEE KENG
      Instructor(s): Grace B. Hopper, Alan Turing
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Chee Keng Yap",
      "Grace B. Hopper",
      "Alan Turing",
    ]);
  });

  it("understands mixed-case Albert last-name-first instructor formatting", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor: Yap, Chee Keng
      Instructor(s): Hopper, Grace B.; Alan Turing
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Chee Keng Yap",
      "Grace B. Hopper",
      "Alan Turing",
    ]);
  });

  it("understands ampersand-separated Albert co-instructors", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor(s): Ada Lovelace & Grace B. Hopper
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Ada Lovelace",
      "Grace B. Hopper",
    ]);
  });

  it("understands accented Albert last-name-first instructor formatting", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor: GARCÍA, JOSÉ
      Instructor(s): Núñez, Ana María
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "José García",
      "Ana María Núñez",
    ]);
  });

  it("understands Albert last-name-first names with surname particles", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor: Van Rossum, Guido
      Instructor(s): DE SOUZA, MARIA
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Guido Van Rossum",
      "Maria De Souza",
    ]);
  });

  it("understands Albert last-name-first names with suffixes on the surname side", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor: SMITH JR., JOHN
      Instructor(s): LEE III, ROBERT
      Instructor: MARTIN III., ROBERT
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "John Smith Jr.",
      "Robert Lee III",
      "Robert Martin III",
    ]);
  });

  it("extracts instructor names that continue on lines after an empty label", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor(s):
      YAP, CHEE KENG
      Grace B. Hopper
      Enrollment Requirement Group
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Chee Keng Yap",
      "Grace B. Hopper",
    ]);
  });

  it("extracts instructor names that continue after a standalone label without a colon", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor(s)
      YAP, CHEE KENG
      Alan Turing
      Section Status Open
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Chee Keng Yap",
      "Alan Turing",
    ]);
  });

  it("ignores Albert role annotations when parsing last-name-first names", () => {
    const text = `
      CSCI-UA 201 Computer Systems Organization
      Instructor: YAP, CHEE KENG (Lecture)
      Instructor(s): HOPPER, GRACE B. (Recitation), Alan Turing (Primary)
    `;

    expect(extractInstructorNamesFromText(text)).toEqual([
      "Chee Keng Yap",
      "Grace B. Hopper",
      "Alan Turing",
    ]);
  });
});
